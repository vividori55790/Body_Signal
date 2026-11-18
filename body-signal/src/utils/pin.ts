import { computeSaltedPinHash, constantTimeEqual, generateSaltHex } from './crypto';
import { getPinMeta, savePinMeta, PinMeta } from './storage';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds base lockout
const MAX_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes exponential cap
export const FIXED_PIN_LENGTH = 6;

export async function isPinConfigured(): Promise<boolean> {
  const meta = await getPinMeta();
  return Boolean(meta && meta.hash && meta.salt);
}

export async function getPinRequirements(): Promise<{ pinLength: number; isOsCredentialOnly: boolean }> {
  const meta = await getPinMeta();
  if (!meta) return { pinLength: FIXED_PIN_LENGTH, isOsCredentialOnly: false };
  return {
    pinLength: meta.pinLength && meta.pinLength >= 4 ? meta.pinLength : FIXED_PIN_LENGTH,
    isOsCredentialOnly: Boolean(meta.isOsCredentialOnly),
  };
}

export async function ensurePinSessionSalt(): Promise<string> {
  const meta = await getPinMeta();
  if (!meta) return generateSaltHex();
  if (meta.sessionSalt) return meta.sessionSalt;
  const sessionSalt = generateSaltHex();
  await savePinMeta({ ...meta, sessionSalt });
  return sessionSalt;
}

export async function setAppPin(
  pin: string,
  options?: { isOsCredentialOnly?: boolean; allowLegacyLength?: boolean }
): Promise<string> {
  if (pin.length < 4 || isNaN(Number(pin))) {
    throw new Error('PIN은 최소 4자리 숫자여야 합니다.');
  }
  if (!/^\d+$/.test(pin)) {
    throw new Error('PIN은 최소 4자리 숫자여야 합니다.');
  }
  if (!options?.isOsCredentialOnly && !options?.allowLegacyLength && pin.length !== FIXED_PIN_LENGTH) {
    throw new Error('보안 정책상 PIN은 6자리 숫자여야 합니다.');
  }
  const { hash, salt } = await computeSaltedPinHash(pin);
  const sessionSalt = generateSaltHex();
  const meta: PinMeta = {
    salt,
    hash,
    failedAttempts: 0,
    lockoutUntil: 0,
    consecutiveLockouts: 0,
    pinLength: pin.length,
    isOsCredentialOnly: Boolean(options?.isOsCredentialOnly),
    sessionSalt,
  };
  await savePinMeta(meta);
  return sessionSalt;
}

export async function removeAppPin(): Promise<void> {
  await savePinMeta(null);
}

export async function checkLockout(): Promise<{ isLocked: boolean; remainingMs: number }> {
  const meta = await getPinMeta();
  if (!meta || !meta.lockoutUntil) return { isLocked: false, remainingMs: 0 };

  const now = Date.now();
  if (now < meta.lockoutUntil) {
    return { isLocked: true, remainingMs: meta.lockoutUntil - now };
  }
  return { isLocked: false, remainingMs: 0 };
}

export async function verifyAppPin(enteredPin: string): Promise<{ success: boolean; lockoutMs?: number; remainingAttempts?: number }> {
  const meta = await getPinMeta();
  if (!meta) return { success: true };

  const lockout = await checkLockout();
  if (lockout.isLocked) {
    return { success: false, lockoutMs: lockout.remainingMs };
  }

  const { hash } = await computeSaltedPinHash(enteredPin, meta.salt);
  if (constantTimeEqual(hash, meta.hash)) {
    // Reset failed attempts and consecutive lockout counter on success
    meta.failedAttempts = 0;
    meta.lockoutUntil = 0;
    meta.consecutiveLockouts = 0;
    await savePinMeta(meta);
    return { success: true };
  }

  // Increment failure count with exponential backoff on consecutive lockouts
  meta.failedAttempts = (meta.failedAttempts || 0) + 1;
  if (meta.failedAttempts >= MAX_ATTEMPTS) {
    const consecutive = (meta.consecutiveLockouts || 0) + 1;
    meta.consecutiveLockouts = consecutive;
    const durationMs =
      consecutive === 1
        ? LOCKOUT_DURATION_MS
        : Math.min(LOCKOUT_DURATION_MS * Math.pow(2, consecutive - 1), MAX_LOCKOUT_MS);
    meta.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    if (consecutive > 1) {
      meta.lockoutUntil = Date.now() + durationMs;
    }
    meta.failedAttempts = 0;
    await savePinMeta(meta);
    return { success: false, lockoutMs: durationMs };
  }

  await savePinMeta(meta);
  return {
    success: false,
    remainingAttempts: MAX_ATTEMPTS - meta.failedAttempts,
  };
}
