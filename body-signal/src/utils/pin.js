const PIN_HASH_KEY = "bs-pin-hash";
const LEGACY_PIN_KEY = "bs-pin";
const LOCKOUT_KEY = "bs-pin-lockout-until";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;

const toHex = (buffer) => Array.from(new Uint8Array(buffer))
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

export const hashPin = async (pin) => {
  const encoded = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toHex(digest);
};

export const savePin = async (pin) => {
  localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
  localStorage.removeItem(LEGACY_PIN_KEY);
};

export const verifyPin = async (pin) => {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (storedHash) {
    return (await hashPin(pin)) === storedHash;
  }

  const legacyPin = localStorage.getItem(LEGACY_PIN_KEY);
  if (legacyPin && pin === legacyPin) {
    await savePin(pin);
    return true;
  }

  return !legacyPin;
};

export const clearPin = () => {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(LEGACY_PIN_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
};

export const getLockoutRemaining = () => {
  const until = Number(localStorage.getItem(LOCKOUT_KEY) || 0);
  return Math.max(0, until - Date.now());
};

export const registerFailedAttempt = () => {
  const attempts = Number(localStorage.getItem("bs-pin-failed-attempts") || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    localStorage.removeItem("bs-pin-failed-attempts");
    return LOCKOUT_MS;
  }
  localStorage.setItem("bs-pin-failed-attempts", String(attempts));
  return 0;
};

export const clearFailedAttempts = () => {
  localStorage.removeItem("bs-pin-failed-attempts");
  localStorage.removeItem(LOCKOUT_KEY);
};
