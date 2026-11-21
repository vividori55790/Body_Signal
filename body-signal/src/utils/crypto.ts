/**
 * Web Crypto API based End-to-End Local Encryption Engine (AES-GCM 256-bit)
 * Uses PBKDF2 (100,000 iterations) with SHA-256 for key derivation.
 * Includes SHA-256 Medical Integrity Signatures & Encrypted Passphrase Backups.
 */

export const DEFAULT_PBKDF2_ITERATIONS = 100_000;
const PBKDF2_ITERATIONS = DEFAULT_PBKDF2_ITERATIONS;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12; // Standard for AES-GCM
const SALT_LENGTH_BYTES = 16;

export const SESSION_KEY_TOKEN = '__NON_EXTRACTABLE_SESSION_KEY__';
let activeSessionCryptoKey: CryptoKey | null = null;
let activeSessionSaltHex: string | null = null;
let activeSessionIterations: number = DEFAULT_PBKDF2_ITERATIONS;

export interface KdfMetadata {
  alg: 'PBKDF2-SHA256';
  iterations: number;
}

export interface EncryptedPackage {
  v: 1;
  salt: string; // Hex
  iv: string;   // Hex
  ct: string;   // Ciphertext in Base64
  mode?: 'pin' | 'device';
  kdf?: KdfMetadata;
}

function resolveIterations(raw?: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 10_000) return DEFAULT_PBKDF2_ITERATIONS;
  return Math.min(2_000_000, Math.round(n));
}

// Convert BufferSource to Hex string
function bufferToHex(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Base64 conversion helpers for ArrayBuffer
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Constant-time string comparison (UTF-8 byte XOR accumulation) to mitigate timing side-channels.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Computes a SHA-256 Checksum hash of any string data (for medical tamper-proof verification).
 */
export async function computeSha256Checksum(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToHex(hashBuffer);
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user PIN / password string using PBKDF2.
 */
export async function deriveKeyFromPin(
  pin: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const safeIterations = resolveIterations(iterations);
  const encoder = new TextEncoder();
  const rawKeyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: safeIterations,
      hash: 'SHA-256',
    },
    rawKeyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random 16-byte salt encoded as hex.
 */
export function generateSaltHex(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  return bufferToHex(salt.buffer);
}

/**
 * Derives and stores a non-extractable (extractable=false) AES-GCM 256 CryptoKey
 * in a module-private closure so plaintext PINs never stay in React state or JS strings.
 */
export async function initSessionCryptoKeyFromPin(
  pin: string,
  saltHex: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<void> {
  const safeIterations = resolveIterations(iterations);
  const salt = hexToBytes(saltHex);
  activeSessionCryptoKey = await deriveKeyFromPin(pin, salt, safeIterations);
  activeSessionSaltHex = saltHex;
  activeSessionIterations = safeIterations;
}

export function clearSessionCryptoKey(): void {
  activeSessionCryptoKey = null;
  activeSessionSaltHex = null;
  activeSessionIterations = DEFAULT_PBKDF2_ITERATIONS;
}

export function hasActiveSessionCryptoKey(): boolean {
  return activeSessionCryptoKey !== null && activeSessionSaltHex !== null;
}

export async function encryptWithActiveSessionKey(plaintext: string): Promise<EncryptedPackage> {
  if (!activeSessionCryptoKey || !activeSessionSaltHex) {
    throw new Error('세션 암호화 키가 초기화되지 않았습니다.');
  }
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    activeSessionCryptoKey,
    encoded
  );
  return {
    v: 1,
    salt: activeSessionSaltHex,
    iv: bufferToHex(iv.buffer),
    ct: bufferToBase64(ciphertextBuffer),
    mode: 'pin',
    kdf: {
      alg: 'PBKDF2-SHA256',
      iterations: activeSessionIterations,
    },
  };
}

export async function decryptWithActiveSessionKey(pkg: EncryptedPackage): Promise<string> {
  if (!activeSessionCryptoKey || !activeSessionSaltHex) {
    throw new Error('세션 암호화 키가 초기화되지 않았습니다.');
  }
  if (pkg.salt !== activeSessionSaltHex) {
    throw new Error('세션 Salt가 일치하지 않아 키 재유도가 필요합니다.');
  }
  if (pkg.kdf?.iterations && resolveIterations(pkg.kdf.iterations) !== activeSessionIterations) {
    throw new Error('세션 KDF 반복 횟수가 일치하지 않아 키 재유도가 필요합니다.');
  }
  return decryptWithKey(pkg, activeSessionCryptoKey);
}

/**
 * Encrypts a plaintext string using a user PIN.
 * Returns an EncryptedPackage containing the salt, IV, ciphertext, and KDF metadata.
 */
export async function encryptWithPin(
  plaintext: string,
  pin: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<EncryptedPackage> {
  const safeIterations = resolveIterations(iterations);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKeyFromPin(pin, salt, safeIterations);

  const encodedData = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedData
  );

  return {
    v: 1,
    salt: bufferToHex(salt.buffer),
    iv: bufferToHex(iv.buffer),
    ct: bufferToBase64(ciphertextBuffer),
    mode: 'pin',
    kdf: {
      alg: 'PBKDF2-SHA256',
      iterations: safeIterations,
    },
  };
}

/**
 * Decrypts an EncryptedPackage using a user PIN.
 * Honors embedded KDF iterations metadata (falling back to 100,000 for legacy v1 packages).
 */
export async function decryptWithPin(pkg: EncryptedPackage, pin: string): Promise<string> {
  const salt = hexToBytes(pkg.salt);
  const iv = hexToBytes(pkg.iv);
  const ciphertextBuffer = base64ToBuffer(pkg.ct);
  const iterations = resolveIterations(pkg.kdf?.iterations);

  const key = await deriveKeyFromPin(pin, salt, iterations);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertextBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error('비밀번호/PIN이 일치하지 않거나 데이터가 손상되었습니다.');
  }
}

/**
 * Encrypts entire backup payload with a custom user passphrase and embeds SHA-256 checksum.
 */
export async function encryptBackupWithPassphrase(
  dataJson: string,
  passphrase: string
): Promise<string> {
  const checksum = await computeSha256Checksum(dataJson);
  const payloadToEncrypt = JSON.stringify({
    payload: dataJson,
    checksum,
    exportedAt: new Date().toISOString(),
  });

  const encrypted = await encryptWithPin(payloadToEncrypt, passphrase);
  return JSON.stringify({
    format: 'bignal-encrypted-backup-v1',
    data: encrypted,
  }, null, 2);
}

/**
 * Decrypts backup file with user passphrase and verifies SHA-256 data integrity.
 */
export async function decryptBackupWithPassphrase(
  encryptedFileContent: string,
  passphrase: string
): Promise<string> {
  let pkg: EncryptedPackage;
  try {
    const parsed = JSON.parse(encryptedFileContent);
    pkg = parsed.data || parsed;
  } catch (e) {
    throw new Error('올바른 백업 파일 형식이 아닙니다.');
  }

  const decryptedJson = await decryptWithPin(pkg, passphrase);
  const envelope = JSON.parse(decryptedJson);

  // Verify Checksum (constant-time)
  if (envelope.checksum && envelope.payload) {
    const calculatedChecksum = await computeSha256Checksum(envelope.payload);
    if (!constantTimeEqual(calculatedChecksum, envelope.checksum)) {
      throw new Error('데이터 무결성 검증 실패: 백업 파일이 변조되었거나 손상되었습니다.');
    }
    return envelope.payload;
  }

  return decryptedJson;
}

/**
 * Computes a secure salted hash of the PIN for quick verification.
 */
export async function computeSaltedPinHash(pin: string, existingSaltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = existingSaltHex ? hexToBytes(existingSaltHex) : crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 50_000,
      hash: 'SHA-256',
    },
    rawKey,
    256
  );

  return {
    hash: bufferToHex(bits),
    salt: bufferToHex(salt.buffer),
  };
}

/**
 * Generates a new 256-bit AES-GCM CryptoKey.
 */
export async function generateAesGcmKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Exports an AES-GCM CryptoKey as a 64-character hex string.
 */
export async function exportKeyToHex(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToHex(raw);
}

/**
 * Imports a 256-bit AES-GCM CryptoKey from a 64-character hex string.
 */
export async function importKeyFromHex(hexKey: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(hexKey);
  return crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random 256-bit device master key hex string.
 */
export function generateDeviceMasterKeyHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufferToHex(bytes.buffer);
}

/**
 * Encrypts plaintext using an AES-GCM CryptoKey directly.
 */
export async function encryptWithKey(
  plaintext: string,
  key: CryptoKey,
  mode: 'pin' | 'device' = 'device'
): Promise<EncryptedPackage> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return {
    v: 1,
    salt: bufferToHex(salt.buffer),
    iv: bufferToHex(iv.buffer),
    ct: bufferToBase64(ciphertextBuffer),
    mode,
  };
}

/**
 * Decrypts an EncryptedPackage using an AES-GCM CryptoKey directly.
 */
export async function decryptWithKey(
  pkg: EncryptedPackage,
  key: CryptoKey
): Promise<string> {
  const iv = hexToBytes(pkg.iv);
  const ciphertextBuffer = base64ToBuffer(pkg.ct);
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertextBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    throw new Error('데이터 복호화 실패: 키가 일치하지 않거나 데이터가 손상되었습니다.');
  }
}

/**
 * Encrypts plaintext with persistent device master key.
 */
export async function encryptWithDeviceKey(
  plaintext: string,
  deviceKey: CryptoKey
): Promise<EncryptedPackage> {
  return encryptWithKey(plaintext, deviceKey, 'device');
}

/**
 * Decrypts ciphertext with persistent device master key.
 */
export async function decryptWithDeviceKey(
  pkg: EncryptedPackage,
  deviceKey: CryptoKey
): Promise<string> {
  return decryptWithKey(pkg, deviceKey);
}

/**
 * Computes a SHA-256 canonical audit signature for a pain log record.
 * Chains with prevSignature to construct a tamper-evident audit chain.
 */
export async function computeRecordSignature(
  record: {
    id: string;
    conditionId: string;
    date: string;
    intensity: number;
    medication?: string;
    postMedIntensity?: number;
    notes?: string;
    radiation?: string;
    painQuality?: string[];
    triggers?: string[];
    reliefFactors?: string[];
    redFlags?: string[];
    prevSignature?: string;
  },
  prevSignature: string = ''
): Promise<string> {
  const baseFields = [
    record.id,
    record.conditionId,
    record.date,
    record.intensity,
    record.medication || '',
    record.postMedIntensity ?? '',
    prevSignature || record.prevSignature || '',
  ];
  const hasExtended = Boolean(
    record.notes ||
      record.radiation ||
      (record.painQuality && record.painQuality.length > 0) ||
      (record.triggers && record.triggers.length > 0) ||
      (record.reliefFactors && record.reliefFactors.length > 0) ||
      (record.redFlags && record.redFlags.length > 0)
  );
  const fields = hasExtended
    ? [
        ...baseFields,
        record.notes || '',
        record.radiation || '',
        (record.painQuality || []).join(','),
        (record.triggers || []).join(','),
        (record.reliefFactors || []).join(','),
        (record.redFlags || []).join(','),
      ]
    : baseFields;
  return computeSha256Checksum(fields.join('|'));
}

/**
 * Verifies that the record has not been altered since it was signed.
 */
export async function verifyRecordSignature(
  record: {
    id: string;
    conditionId: string;
    date: string;
    intensity: number;
    medication?: string;
    postMedIntensity?: number;
    notes?: string;
    radiation?: string;
    painQuality?: string[];
    triggers?: string[];
    reliefFactors?: string[];
    redFlags?: string[];
    signature?: string;
    prevSignature?: string;
  }
): Promise<boolean> {
  if (!record.signature) {
    return false;
  }
  const expected = await computeRecordSignature(record, record.prevSignature || '');
  return constantTimeEqual(record.signature, expected);
}

/**
 * Returns the original genesis signature created when a record first entered the audit chain.
 * If the record was revised/reassigned/soft-deleted later, revisions[0].previous.signature
 * preserves the link that downstream records' prevSignature points to.
 */
export function getGenesisSignature(record: {
  signature?: string;
  revisions?: Array<{ previous?: { signature?: string } }>;
}): string {
  const firstRevSig = record.revisions?.[0]?.previous?.signature;
  return firstRevSig || record.signature || '';
}

export interface AuditChainVerificationResult {
  valid: boolean;
  checkedCount: number;
  brokenIds: string[];
}

/**
 * Verifies an entire PainLog audit chain:
 * 1) Each signed record matches computeRecordSignature
 * 2) Each revision's pre-edit snapshot (if signed) matches computeRecordSignature
 * 3) Adjacent records sorted in chain order (chainIndex asc / signedAt asc) link via prevSignature -> genesis signature
 */
export async function verifyAuditChain(
  records: Array<{
    id: string;
    conditionId: string;
    date: string;
    intensity: number;
    medication?: string;
    postMedIntensity?: number;
    notes?: string;
    radiation?: string;
    painQuality?: string[];
    triggers?: string[];
    reliefFactors?: string[];
    redFlags?: string[];
    signature?: string;
    prevSignature?: string;
    signedAt?: string;
    chainIndex?: number;
    revisions?: Array<{
      editedAt: string;
      reason?: string;
      previous: Record<string, any>;
    }>;
  }>
): Promise<AuditChainVerificationResult> {
  const signed = records.filter((r) => Boolean(r.signature));
  if (signed.length === 0) {
    return { valid: true, checkedCount: 0, brokenIds: [] };
  }

  const getOriginalSignedTime = (r: (typeof signed)[number]): number => {
    const genesisSignedAt = r.revisions?.[0]?.previous?.signedAt || r.signedAt;
    return genesisSignedAt ? new Date(genesisSignedAt).getTime() : 0;
  };

  const ordered = [...signed].sort((a, b) => {
    const aHasIdx = typeof a.chainIndex === 'number';
    const bHasIdx = typeof b.chainIndex === 'number';
    if (aHasIdx && bHasIdx && a.chainIndex !== b.chainIndex) {
      return (a.chainIndex as number) - (b.chainIndex as number);
    }
    const aTime = getOriginalSignedTime(a);
    const bTime = getOriginalSignedTime(b);
    if (aTime !== bTime) return aTime - bTime;
    return 0;
  });

  const brokenIds: string[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const rec = ordered[i];
    const currentOk = await verifyRecordSignature(rec);
    if (!currentOk) {
      brokenIds.push(rec.id);
      continue;
    }

    if (rec.revisions && rec.revisions.length > 0) {
      let revOk = true;
      for (const rev of rec.revisions) {
        if (rev.previous?.signature) {
          const prevSnapOk = await verifyRecordSignature({
            id: rec.id,
            conditionId: String(rev.previous.conditionId || rec.conditionId),
            date: String(rev.previous.date || rec.date),
            intensity: Number(rev.previous.intensity ?? rec.intensity),
            medication: rev.previous.medication,
            postMedIntensity: rev.previous.postMedIntensity,
            notes: rev.previous.notes,
            radiation: rev.previous.radiation,
            painQuality: rev.previous.painQuality,
            triggers: rev.previous.triggers,
            reliefFactors: rev.previous.reliefFactors,
            redFlags: rev.previous.redFlags,
            signature: rev.previous.signature,
            prevSignature: rev.previous.prevSignature,
          });
          if (!prevSnapOk) {
            revOk = false;
            break;
          }
        }
      }
      if (!revOk) {
        brokenIds.push(rec.id);
        continue;
      }
    }

    if (i > 0) {
      const prevRec = ordered[i - 1];
      const expectedPrevSig = getGenesisSignature(prevRec);
      if ((rec.prevSignature || '') !== expectedPrevSig) {
        brokenIds.push(rec.id);
      }
    }
  }

  return {
    valid: brokenIds.length === 0,
    checkedCount: ordered.length,
    brokenIds,
  };
}

/**
 * Computes a SHA-256 integrity signature for a DiagnosticRecord.
 */
export async function computeDiagnosticSignature(
  record: {
    id: string;
    conditionId?: string;
    diagnosisDate: string;
    diagnosisName: string;
    hospitalName?: string;
    department?: string;
    amountKrw?: number;
    notes?: string;
    photoIds?: string[];
    claimStatus?: string;
    deletedAt?: string;
    prevSignature?: string;
  },
  prevSignature: string = ''
): Promise<string> {
  const fields = [
    record.id,
    record.conditionId || '',
    record.diagnosisDate,
    record.diagnosisName,
    record.hospitalName || '',
    record.department || '',
    record.amountKrw ?? '',
    record.notes || '',
    (record.photoIds || []).join(','),
    record.claimStatus || 'pending',
    record.deletedAt || '',
    prevSignature || record.prevSignature || '',
  ];
  return computeSha256Checksum(fields.join('|'));
}

export async function verifyDiagnosticSignature(record: {
  id: string;
  conditionId?: string;
  diagnosisDate: string;
  diagnosisName: string;
  hospitalName?: string;
  department?: string;
  amountKrw?: number;
  notes?: string;
  photoIds?: string[];
  claimStatus?: string;
  deletedAt?: string;
  signature?: string;
  prevSignature?: string;
}): Promise<boolean> {
  if (!record.signature) return false;
  const expected = await computeDiagnosticSignature(record, record.prevSignature || '');
  return constantTimeEqual(record.signature, expected);
}

// Aliases for compatibility
export const canonicalSignPainRecord = computeRecordSignature;
export const signRecord = computeRecordSignature;
export const signPainLogRecord = computeRecordSignature;
export const verifyRecordIntegrity = verifyRecordSignature;
export const verifyPainLogIntegrity = verifyRecordSignature;

