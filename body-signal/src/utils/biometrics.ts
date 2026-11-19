/**
 * Biometric / Passkey Authentication Engine
 * Standards-compliant WebAuthn (PublicKeyCredential) with platform authenticator
 * Supports biometric PIN wrapping/unwrapping using AES-GCM 256 device key.
 */
import { openDB } from 'idb';
import { getOrCreateDeviceMasterKey } from './storage';
import { encryptWithDeviceKey, decryptWithDeviceKey, EncryptedPackage } from './crypto';
import { verifyAppPin } from './pin';
import SecureAuth, { isNativeAndroidSecureAuth } from './secureAuthBridge';

export interface BiometricMeta {
  enabled: boolean;
  credentialId?: string; // Base64 credential id
  wrappedPin?: EncryptedPackage;
  authenticatorType: 'native-keystore' | 'webauthn' | 'mock';
  enrolledAt: string;
}

const DB_NAME = 'bignal_mobile_db';
const DB_VERSION = 3;

let memoryMeta: BiometricMeta | null = null;
let mockModeOverride: boolean | null = null;

export function setBiometricMockMode(enabled: boolean | null): void {
  mockModeOverride = enabled;
}

// Convert Buffer to Base64 and vice-versa
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
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
 * Storage helpers with multi-tier fallback (IndexedDB -> localStorage -> in-memory)
 */
export async function getBiometricMeta(): Promise<BiometricMeta | null> {
  if (mockModeOverride === null && isNativeAndroidSecureAuth()) {
    try {
      const res = await SecureAuth.isBiometricEnrolled();
      if (res.enrolled) {
        return {
          enabled: true,
          authenticatorType: 'native-keystore',
          enrolledAt: res.enrolledAt || new Date().toISOString(),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  if (memoryMeta) return memoryMeta;

  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openDB(DB_NAME, DB_VERSION);
      if (db.objectStoreNames.contains('app_state')) {
        const val = await db.get('app_state', 'biometric_meta');
        if (val) {
          memoryMeta = val;
          return val;
        }
      }
    }
  } catch {
    // Fall back to localStorage / memory
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('bs-biometric-meta-v1');
      if (raw) {
        memoryMeta = JSON.parse(raw);
        return memoryMeta;
      }
    }
  } catch {}

  return memoryMeta;
}

export async function saveBiometricMeta(meta: BiometricMeta | null): Promise<void> {
  memoryMeta = meta;

  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openDB(DB_NAME, DB_VERSION);
      if (db.objectStoreNames.contains('app_state')) {
        if (meta === null) {
          await db.delete('app_state', 'biometric_meta');
        } else {
          await db.put('app_state', meta, 'biometric_meta');
        }
      }
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      if (meta === null) {
        localStorage.removeItem('bs-biometric-meta-v1');
      } else {
        localStorage.setItem('bs-biometric-meta-v1', JSON.stringify(meta));
      }
    }
  } catch {}
}

/**
 * Checks if biometric / platform passkey authentication is available on device
 */
export async function checkBiometricAvailability(options?: {
  allowDeviceCredential?: boolean;
}): Promise<boolean> {
  if (mockModeOverride !== null) return mockModeOverride;
  if (typeof window === 'undefined') return false;

  if (isNativeAndroidSecureAuth()) {
    try {
      const res = await SecureAuth.isBiometricAvailable();
      if (options?.allowDeviceCredential) {
        return Boolean(res.available);
      }
      if (typeof res.strongBiometric === 'boolean') {
        return res.strongBiometric;
      }
      return Boolean(res.available);
    } catch (err) {
      console.warn('Native biometric availability check failed:', err);
      return false;
    }
  }

  try {
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (err) {
    console.warn('Biometric availability check failed:', err);
  }
  return false;
}

/**
 * Enrolls biometrics with user's validated PIN
 */
export async function enrollBiometrics(
  pin: string,
  options?: { allowDeviceCredential?: boolean }
): Promise<boolean> {
  try {
    // 1. Verify PIN before enrollment
    const pinCheck = await verifyAppPin(pin);
    if (!pinCheck.success) {
      return false;
    }

    // Native Android path: Hardware-backed AndroidKeyStore + BiometricPrompt
    if (mockModeOverride === null && isNativeAndroidSecureAuth()) {
      const isEn = typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';
      const allowDeviceCredential = Boolean(options?.allowDeviceCredential);
      const res = await SecureAuth.enrollBiometricPin({
        pin,
        title: isEn ? 'Enable Biometric Unlock' : '생체인증 등록',
        subtitle: isEn
          ? 'Protect app unlock with your device fingerprint or biometrics.'
          : '지문 또는 생체정보로 앱 잠금을 안전하게 보호합니다.',
        negativeButtonText: isEn ? 'Cancel' : '취소',
        allowDeviceCredential,
      });
      if (res.success) {
        await saveBiometricMeta(null);
      }
      return Boolean(res.success);
    }

    let credentialId: string | undefined = undefined;
    let authType: 'webauthn' | 'mock' = 'webauthn';

    // 2. Enforce real WebAuthn platform verification unless explicitly running in test mock mode
    if (mockModeOverride === true) {
      authType = 'mock';
    } else {
      if (
        typeof window === 'undefined' ||
        !window.PublicKeyCredential ||
        !navigator.credentials
      ) {
        return false;
      }

      try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));
        const rpId = window.location.hostname || undefined;

        const credential = (await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'Bignal Medical',
              id: rpId,
            },
            user: {
              id: userId,
              name: 'bignal-user',
              displayName: 'Bignal Patient',
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' },
              { alg: -257, type: 'public-key' },
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        })) as PublicKeyCredential | null;

        if (!credential) {
          return false;
        }
        credentialId = bufferToBase64(credential.rawId);
        authType = 'webauthn';
      } catch (authErr: any) {
        // Fail-closed: never fall back to mock authentication in production
        console.warn('WebAuthn biometric enrollment unavailable or cancelled:', authErr?.name || authErr);
        return false;
      }
    }

    // 3. Encrypt PIN using persistent device master key
    const deviceKey = await getOrCreateDeviceMasterKey();
    const wrappedPin = await encryptWithDeviceKey(pin, deviceKey);

    // 4. Save metadata
    await saveBiometricMeta({
      enabled: true,
      credentialId,
      wrappedPin,
      authenticatorType: authType,
      enrolledAt: new Date().toISOString(),
    });

    return true;
  } catch (err) {
    console.error('Failed to enroll biometrics:', err);
    return false;
  }
}

/**
 * Re-wraps existing biometric PIN when user changes their PIN.
 * Returns true if biometric token was successfully updated (or wasn't enabled),
 * or false if the user cancelled / failed re-enrollment.
 */
export async function updateBiometricPinToken(newPin: string): Promise<boolean> {
  if (mockModeOverride === null && isNativeAndroidSecureAuth()) {
    const res = await SecureAuth.isBiometricEnrolled();
    if (!res.enrolled) return true;
    return await enrollBiometrics(newPin);
  }

  const meta = await getBiometricMeta();
  if (!meta || !meta.enabled) return true;

  const deviceKey = await getOrCreateDeviceMasterKey();
  const wrappedPin = await encryptWithDeviceKey(newPin, deviceKey);
  await saveBiometricMeta({
    ...meta,
    wrappedPin,
  });
  return true;
}

/**
 * Disables and deletes biometric credentials
 */
export async function disableBiometrics(): Promise<void> {
  if (isNativeAndroidSecureAuth()) {
    try {
      await SecureAuth.clearBiometricPin();
    } catch {}
  }
  await saveBiometricMeta(null);
}

/**
 * Prompts user for biometric verification and unwraps active session PIN
 * Resolves { success: false } smoothly without throwing on cancel or failure.
 */
export async function authenticateWithBiometrics(options?: {
  allowDeviceCredential?: boolean;
  expectedPinLength?: number;
}): Promise<{ success: boolean; pin?: string }> {
  try {
    // Native Android path: Hardware-backed AndroidKeyStore + BiometricPrompt CryptoObject
    if (mockModeOverride === null && isNativeAndroidSecureAuth()) {
      const isEn = typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';
      const allowDeviceCredential = Boolean(options?.allowDeviceCredential);
      const pinLen = options?.expectedPinLength || 6;
      const res = await SecureAuth.authenticateBiometricPin({
        title: isEn ? 'Biometric Unlock' : '생체인증 잠금 해제',
        subtitle: isEn
          ? 'Verify your biometrics to unlock health records.'
          : '건강 데이터 접근을 위해 본인 인증이 필요합니다.',
        negativeButtonText: allowDeviceCredential
          ? isEn
            ? 'Cancel'
            : '취소'
          : isEn
          ? `Enter ${pinLen}-digit PIN`
          : `${pinLen}자리 PIN 입력`,
        allowDeviceCredential,
      });
      if (!res.success || !res.pin) {
        return { success: false };
      }
      const pinResult = await verifyAppPin(res.pin);
      if (!pinResult.success) {
        return { success: false };
      }
      return { success: true, pin: res.pin };
    }

    const meta = await getBiometricMeta();
    if (!meta || !meta.enabled || !meta.wrappedPin) {
      return { success: false };
    }

    // 1. Require WebAuthn platform assertion unless explicitly running in test mock mode
    if (mockModeOverride !== true) {
      if (
        meta.authenticatorType !== 'webauthn' ||
        !meta.credentialId ||
        typeof window === 'undefined' ||
        !navigator.credentials
      ) {
        return { success: false };
      }

      try {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const credentialIdBuffer = base64ToBuffer(meta.credentialId);

        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [
              {
                id: credentialIdBuffer,
                type: 'public-key',
              },
            ],
            userVerification: 'required',
            timeout: 60000,
          },
        });

        if (!assertion) {
          return { success: false };
        }
      } catch (promptErr: any) {
        // User cancelled prompt or fingerprint mismatch
        console.info('Biometric prompt cancelled or failed:', promptErr.name);
        return { success: false };
      }
    }

    // 2. Unwrap PIN using persistent device master key
    const deviceKey = await getOrCreateDeviceMasterKey();
    const pin = await decryptWithDeviceKey(meta.wrappedPin, deviceKey);

    // 3. Verify PIN validity
    const pinResult = await verifyAppPin(pin);
    if (!pinResult.success) {
      return { success: false };
    }

    return { success: true, pin };
  } catch (err) {
    console.warn('Biometric authentication failed smoothly:', err);
    return { success: false };
  }
}
