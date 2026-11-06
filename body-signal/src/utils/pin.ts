import { computeSaltedPinHash } from './crypto';
import { getPinMeta, savePinMeta, PinMeta } from './storage';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds

export async function isPinConfigured(): Promise<boolean> {
  const meta = await getPinMeta();
  return Boolean(meta && meta.hash && meta.salt);
}

export async function setAppPin(pin: string): Promise<void> {
  if (pin.length < 4 || isNaN(Number(pin))) {
    throw new Error('PIN은 최소 4자리 숫자여야 합니다.');
  }
  const { hash, salt } = await computeSaltedPinHash(pin);
  const meta: PinMeta = {
    salt,
    hash,
    failedAttempts: 0,
    lockoutUntil: 0,
  };
  await savePinMeta(meta);
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
  if (hash === meta.hash) {
    // Reset failed attempts on success
    meta.failedAttempts = 0;
    meta.lockoutUntil = 0;
    await savePinMeta(meta);
    return { success: true };
  }

  // Increment failure count
  meta.failedAttempts = (meta.failedAttempts || 0) + 1;
  if (meta.failedAttempts >= MAX_ATTEMPTS) {
    meta.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    meta.failedAttempts = 0;
    await savePinMeta(meta);
    return { success: false, lockoutMs: LOCKOUT_DURATION_MS };
  }

  await savePinMeta(meta);
  return {
    success: false,
    remainingAttempts: MAX_ATTEMPTS - meta.failedAttempts,
  };
}
