/**
 * RFC 6238 Offline TOTP (2FA) Engine using Web Crypto API (HMAC-SHA1).
 * 100% on-device, compatible with FOSS authenticator apps (e.g. Aegis, FreeOTP).
 */
import {
  computeSha256Checksum,
  constantTimeEqual,
  SESSION_KEY_TOKEN,
  encryptWithPin,
  decryptWithPin,
  encryptWithActiveSessionKey,
  decryptWithActiveSessionKey,
  hasActiveSessionCryptoKey,
  encryptWithDeviceKey,
  decryptWithDeviceKey,
  EncryptedPackage,
} from './crypto';
import { getDB, getOrCreateDeviceMasterKey } from './storage';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_MAX_ATTEMPTS = 5;
const TOTP_BASE_LOCKOUT_MS = 30 * 1000;
const TOTP_MAX_LOCKOUT_MS = 5 * 60 * 1000;

export interface TotpMeta {
  enabled: boolean;
  encryptedSecret: EncryptedPackage;
  recoveryHashes: string[];
  enrolledAt: string;
  failedAttempts?: number;
  lockoutUntil?: number;
  consecutiveLockouts?: number;
  lastUsedStep?: number;
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(base32: string): Uint8Array {
  const cleaned = (base32 || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return encodeBase32(bytes);
}

export function buildOtpAuthUri(secret: string, accountLabel = 'LocalUser'): string {
  const issuer = 'Body Signal';
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export async function generateTotpCode(secret: string, timeMs: number = Date.now()): Promise<string> {
  const keyBytes = decodeBase32(secret);
  const counter = Math.floor(timeMs / 1000 / 30);

  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuf));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

export async function verifyTotpCode(secret: string, code: string, timeMs: number = Date.now()): Promise<boolean> {
  const normalized = (code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  for (const offsetSteps of [-1, 0, 1]) {
    const candidate = await generateTotpCode(secret, timeMs + offsetSteps * 30_000);
    if (constantTimeEqual(candidate, normalized)) {
      return true;
    }
  }
  return false;
}

async function verifyTotpCodeWithStep(
  secret: string,
  code: string,
  timeMs: number = Date.now()
): Promise<{ matched: boolean; matchedStep: number | null }> {
  const normalized = (code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) return { matched: false, matchedStep: null };

  const baseStep = Math.floor(timeMs / 1000 / 30);
  for (const offsetSteps of [-1, 0, 1]) {
    const stepTimeMs = timeMs + offsetSteps * 30_000;
    const candidate = await generateTotpCode(secret, stepTimeMs);
    if (constantTimeEqual(candidate, normalized)) {
      return { matched: true, matchedStep: baseStep + offsetSteps };
    }
  }
  return { matched: false, matchedStep: null };
}

export function generateRecoveryCodes(count = 8): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    let raw = '';
    for (let j = 0; j < 8; j++) {
      raw += chars[bytes[j] % chars.length];
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

export async function getTotpMeta(): Promise<TotpMeta | null> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await getDB();
      if (db.objectStoreNames.contains('app_state')) {
        return (await db.get('app_state', 'totp_meta')) || null;
      }
    }
  } catch {}
  return null;
}

async function decryptTotpSecret(pkg: EncryptedPackage, pin?: string): Promise<string> {
  if (pkg.mode === 'pin') {
    if (pin === SESSION_KEY_TOKEN || hasActiveSessionCryptoKey()) {
      try {
        return await decryptWithActiveSessionKey(pkg);
      } catch {}
    }
    if (pin && pin !== SESSION_KEY_TOKEN) {
      return decryptWithPin(pkg, pin);
    }
  }
  try {
    const deviceKey = await getOrCreateDeviceMasterKey();
    return await decryptWithDeviceKey(pkg, deviceKey);
  } catch (err) {
    if (pin && pin !== SESSION_KEY_TOKEN) {
      return decryptWithPin(pkg, pin);
    }
    throw err;
  }
}

export async function enableTotp2FA(
  secret: string,
  recoveryCodes: string[],
  pin?: string
): Promise<void> {
  let encryptedSecret: EncryptedPackage;
  if (pin === SESSION_KEY_TOKEN || (!pin && hasActiveSessionCryptoKey())) {
    encryptedSecret = await encryptWithActiveSessionKey(secret);
  } else if (pin) {
    encryptedSecret = await encryptWithPin(secret, pin);
  } else {
    const deviceKey = await getOrCreateDeviceMasterKey();
    encryptedSecret = await encryptWithDeviceKey(secret, deviceKey);
  }
  const recoveryHashes = await Promise.all(
    recoveryCodes.map((c) => computeSha256Checksum(c.trim().toUpperCase()))
  );

  const meta: TotpMeta = {
    enabled: true,
    encryptedSecret,
    recoveryHashes,
    enrolledAt: new Date().toISOString(),
    failedAttempts: 0,
    lockoutUntil: 0,
    consecutiveLockouts: 0,
  };

  const db = await getDB();
  await db.put('app_state', meta, 'totp_meta');
}

export async function migrateTotpToSessionKey(rawPin: string): Promise<void> {
  if (!hasActiveSessionCryptoKey()) return;
  const meta = await getTotpMeta();
  if (!meta || !meta.enabled || !meta.encryptedSecret) return;
  try {
    await decryptWithActiveSessionKey(meta.encryptedSecret);
  } catch {
    try {
      const secret = await decryptTotpSecret(meta.encryptedSecret, rawPin);
      const nextEncrypted = await encryptWithActiveSessionKey(secret);
      const db = await getDB();
      await db.put('app_state', { ...meta, encryptedSecret: nextEncrypted }, 'totp_meta');
    } catch {}
  }
}

export async function reEncryptTotpSecret(newPin?: string, oldPin?: string): Promise<void> {
  const meta = await getTotpMeta();
  if (!meta || !meta.enabled || !meta.encryptedSecret) return;

  try {
    const secret = await decryptTotpSecret(meta.encryptedSecret, oldPin);
    let nextEncrypted: EncryptedPackage;
    if (newPin === SESSION_KEY_TOKEN) {
      nextEncrypted = await encryptWithActiveSessionKey(secret);
    } else if (newPin) {
      nextEncrypted = await encryptWithPin(secret, newPin);
    } else {
      const deviceKey = await getOrCreateDeviceMasterKey();
      nextEncrypted = await encryptWithDeviceKey(secret, deviceKey);
    }
    const db = await getDB();
    await db.put('app_state', { ...meta, encryptedSecret: nextEncrypted }, 'totp_meta');
  } catch (err) {
    console.warn('TOTP secret re-encryption skipped:', err);
  }
}

export async function disableTotp2FA(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('app_state', 'totp_meta');
  } catch {}
}

export async function verifyStoredTotpOrRecovery(
  input: string,
  pin?: string
): Promise<{ valid: boolean; usedRecovery: boolean; lockoutMs?: number; remainingAttempts?: number }> {
  const meta = await getTotpMeta();
  if (!meta || !meta.enabled) return { valid: true, usedRecovery: false };

  const now = Date.now();
  if (meta.lockoutUntil && now < meta.lockoutUntil) {
    return { valid: false, usedRecovery: false, lockoutMs: meta.lockoutUntil - now };
  }

  const db = await getDB();
  const recordFailure = async (): Promise<{ valid: false; usedRecovery: false; lockoutMs?: number; remainingAttempts?: number }> => {
    const failed = (meta.failedAttempts || 0) + 1;
    if (failed >= TOTP_MAX_ATTEMPTS) {
      const consecutive = (meta.consecutiveLockouts || 0) + 1;
      const durationMs = Math.min(TOTP_BASE_LOCKOUT_MS * Math.pow(2, consecutive - 1), TOTP_MAX_LOCKOUT_MS);
      await db.put(
        'app_state',
        {
          ...meta,
          failedAttempts: 0,
          consecutiveLockouts: consecutive,
          lockoutUntil: Date.now() + durationMs,
        },
        'totp_meta'
      );
      return { valid: false, usedRecovery: false, lockoutMs: durationMs };
    }
    await db.put('app_state', { ...meta, failedAttempts: failed }, 'totp_meta');
    return {
      valid: false,
      usedRecovery: false,
      remainingAttempts: TOTP_MAX_ATTEMPTS - failed,
    };
  };

  const cleaned = (input || '').trim();
  if (/^\d{6}$/.test(cleaned.replace(/\s+/g, ''))) {
    const secret = await decryptTotpSecret(meta.encryptedSecret, pin);
    const { matched, matchedStep } = await verifyTotpCodeWithStep(secret, cleaned, now);
    if (matched && matchedStep !== null) {
      // Prevent TOTP token replay within the same or earlier 30s time step
      if (typeof meta.lastUsedStep === 'number' && matchedStep <= meta.lastUsedStep) {
        return recordFailure();
      }
      await db.put(
        'app_state',
        {
          ...meta,
          failedAttempts: 0,
          lockoutUntil: 0,
          consecutiveLockouts: 0,
          lastUsedStep: matchedStep,
        },
        'totp_meta'
      );
      return { valid: true, usedRecovery: false };
    }
    return recordFailure();
  }

  // Check one-time recovery code (constant-time comparison across all entries)
  const normalizedRecovery = cleaned.toUpperCase();
  const inputHash = await computeSha256Checksum(normalizedRecovery);
  let matchedIdx = -1;
  for (let i = 0; i < meta.recoveryHashes.length; i++) {
    if (constantTimeEqual(meta.recoveryHashes[i], inputHash)) {
      matchedIdx = i;
    }
  }
  if (matchedIdx >= 0) {
    const remaining = meta.recoveryHashes.filter((_, i) => i !== matchedIdx);
    await db.put(
      'app_state',
      {
        ...meta,
        recoveryHashes: remaining,
        failedAttempts: 0,
        lockoutUntil: 0,
        consecutiveLockouts: 0,
      },
      'totp_meta'
    );
    return { valid: true, usedRecovery: true };
  }

  return recordFailure();
}
