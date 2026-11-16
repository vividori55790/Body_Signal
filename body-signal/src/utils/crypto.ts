/**
 * Web Crypto API based End-to-End Local Encryption Engine (AES-GCM 256-bit)
 * Uses PBKDF2 (100,000 iterations) with SHA-256 for key derivation.
 * Includes SHA-256 Medical Integrity Signatures & Encrypted Passphrase Backups.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH_BYTES = 12; // Standard for AES-GCM
const SALT_LENGTH_BYTES = 16;

export interface EncryptedPackage {
  v: 1;
  salt: string; // Hex
  iv: string;   // Hex
  ct: string;   // Ciphertext in Base64
  mode?: 'pin' | 'device';
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
export async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
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
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    rawKeyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using a user PIN.
 * Returns an EncryptedPackage containing the salt, IV, and ciphertext.
 */
export async function encryptWithPin(plaintext: string, pin: string): Promise<EncryptedPackage> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveKeyFromPin(pin, salt);

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
  };
}

/**
 * Decrypts an EncryptedPackage using a user PIN.
 * Returns the decrypted plaintext string, or throws an error if authentication/PIN fails.
 */
export async function decryptWithPin(pkg: EncryptedPackage, pin: string): Promise<string> {
  const salt = hexToBytes(pkg.salt);
  const iv = hexToBytes(pkg.iv);
  const ciphertextBuffer = base64ToBuffer(pkg.ct);

  const key = await deriveKeyFromPin(pin, salt);

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

  // Verify Checksum
  if (envelope.checksum && envelope.payload) {
    const calculatedChecksum = await computeSha256Checksum(envelope.payload);
    if (calculatedChecksum !== envelope.checksum) {
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
    prevSignature?: string;
  },
  prevSignature: string = ''
): Promise<string> {
  const canonicalStr = [
    record.id,
    record.conditionId,
    record.date,
    record.intensity,
    record.medication || '',
    record.postMedIntensity ?? '',
    prevSignature || record.prevSignature || '',
  ].join('|');
  return computeSha256Checksum(canonicalStr);
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
    signature?: string;
    prevSignature?: string;
  }
): Promise<boolean> {
  if (!record.signature) {
    return false;
  }
  const expected = await computeRecordSignature(record, record.prevSignature || '');
  return record.signature === expected;
}

// Aliases for compatibility
export const canonicalSignPainRecord = computeRecordSignature;
export const signRecord = computeRecordSignature;
export const signPainLogRecord = computeRecordSignature;
export const verifyRecordIntegrity = verifyRecordSignature;
export const verifyPainLogIntegrity = verifyRecordSignature;

