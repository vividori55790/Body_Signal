/**
 * RFC 6238 Offline TOTP (2FA) Engine using Web Crypto API (HMAC-SHA1).
 * 100% on-device, compatible with FOSS authenticator apps (e.g. Aegis, FreeOTP).
 */
import { computeSha256Checksum, encryptWithDeviceKey, decryptWithDeviceKey, EncryptedPackage } from './crypto';
import { getDB, getOrCreateDeviceMasterKey } from './storage';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export interface TotpMeta {
  enabled: boolean;
  encryptedSecret: EncryptedPackage;
  recoveryHashes: string[];
  enrolledAt: string;
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
    if (candidate === normalized) {
      return true;
    }
  }
  return false;
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

export async function enableTotp2FA(secret: string, recoveryCodes: string[]): Promise<void> {
  const deviceKey = await getOrCreateDeviceMasterKey();
  const encryptedSecret = await encryptWithDeviceKey(secret, deviceKey);
  const recoveryHashes = await Promise.all(
    recoveryCodes.map((c) => computeSha256Checksum(c.trim().toUpperCase()))
  );

  const meta: TotpMeta = {
    enabled: true,
    encryptedSecret,
    recoveryHashes,
    enrolledAt: new Date().toISOString(),
  };

  const db = await getDB();
  await db.put('app_state', meta, 'totp_meta');
}

export async function disableTotp2FA(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('app_state', 'totp_meta');
  } catch {}
}

export async function verifyStoredTotpOrRecovery(input: string): Promise<{ valid: boolean; usedRecovery: boolean }> {
  const meta = await getTotpMeta();
  if (!meta || !meta.enabled) return { valid: true, usedRecovery: false };

  const cleaned = (input || '').trim();
  if (/^\d{6}$/.test(cleaned.replace(/\s+/g, ''))) {
    const deviceKey = await getOrCreateDeviceMasterKey();
    const secret = await decryptWithDeviceKey(meta.encryptedSecret, deviceKey);
    const ok = await verifyTotpCode(secret, cleaned);
    return { valid: ok, usedRecovery: false };
  }

  // Check one-time recovery code
  const normalizedRecovery = cleaned.toUpperCase();
  const inputHash = await computeSha256Checksum(normalizedRecovery);
  const idx = meta.recoveryHashes.indexOf(inputHash);
  if (idx >= 0) {
    const remaining = meta.recoveryHashes.filter((_, i) => i !== idx);
    const db = await getDB();
    await db.put('app_state', { ...meta, recoveryHashes: remaining }, 'totp_meta');
    return { valid: true, usedRecovery: true };
  }

  return { valid: false, usedRecovery: false };
}
