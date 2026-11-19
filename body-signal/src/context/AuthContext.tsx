import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import {
  isPinConfigured,
  getPinRequirements,
  ensurePinSessionSalt,
  verifyAppPin,
  setAppPin,
  removeAppPin,
  checkLockout,
  FIXED_PIN_LENGTH,
} from '../utils/pin';
import {
  SESSION_KEY_TOKEN,
  initSessionCryptoKeyFromPin,
  clearSessionCryptoKey,
} from '../utils/crypto';
import { reEncryptHealthData, migratePinRecordsToSessionKey } from '../utils/storage';
import SecureAuth, { isNativeAndroidSecureAuth } from '../utils/secureAuthBridge';
import {
  checkBiometricAvailability,
  getBiometricMeta,
  enrollBiometrics,
  disableBiometrics,
  authenticateWithBiometrics,
  updateBiometricPinToken,
} from '../utils/biometrics';
import {
  getTotpMeta,
  enableTotp2FA,
  disableTotp2FA,
  verifyStoredTotpOrRecovery,
} from '../utils/totp';

interface AuthContextValue {
  isAuthReady: boolean;
  isUnlocked: boolean;
  isPinSet: boolean;
  isDeviceCompromised: boolean;
  deviceIntegrityReason: string;
  pinLengthHint: number;
  isOsCredentialOnly: boolean;
  activeSessionPin: string | null;
  lockoutRemainingMs: number;
  isPrivacyMasked: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  isTotpEnabled: boolean;
  pendingTwoFactor: boolean;
  unlockApp: (pin: string) => Promise<{ success: boolean; message?: string; requiresTwoFactor?: boolean }>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  verifyTwoFactorAndUnlock: (code: string) => Promise<{ success: boolean; usedRecovery?: boolean; message?: string }>;
  cancelTwoFactor: () => void;
  toggleBiometric: (enable: boolean, verifiedPin?: string) => Promise<boolean>;
  setupOsCredentialLock: () => Promise<boolean>;
  setupOsCredentialLockWithRecovery: () => Promise<{ success: boolean; recoveryPin?: string }>;
  enableTotp: (secret: string, recoveryCodes: string[]) => Promise<void>;
  disableTotp: (verificationCode: string) => Promise<{ success: boolean; message?: string }>;
  setupNewPin: (pin: string) => Promise<{ biometricSynced: boolean }>;
  disablePin: () => Promise<void>;
  lockApp: () => void;
  beginExternalPickerGrace: (durationMs?: number) => void;
  verifySensitiveActionPin: (pin: string) => Promise<{ success: boolean; message?: string }>;
  verifySensitiveActionBiometric: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Auto-lock timeout when backgrounded (default 60 seconds) and idle timeout (3 minutes)
const AUTO_LOCK_TIMEOUT_MS = 60_000;
const IDLE_LOCK_TIMEOUT_MS = 3 * 60_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPinSet, setIsPinSet] = useState(false);
  const [isDeviceCompromised, setIsDeviceCompromised] = useState(false);
  const [deviceIntegrityReason, setDeviceIntegrityReason] = useState('');
  const [pinLengthHint, setPinLengthHint] = useState(FIXED_PIN_LENGTH);
  const [isOsCredentialOnly, setIsOsCredentialOnly] = useState(false);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isTotpEnabled, setIsTotpEnabled] = useState(false);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(false);

  const backgroundTimeRef = useRef<number | null>(null);
  const externalPickerGraceUntilRef = useRef<number | null>(null);
  const isPinSetRef = useRef<boolean>(false);
  const isTotpEnabledRef = useRef<boolean>(false);
  const isOsCredentialOnlyRef = useRef<boolean>(false);
  const pinLengthHintRef = useRef<number>(FIXED_PIN_LENGTH);
  const pendingPinRef = useRef<string | null>(null);

  const beginExternalPickerGrace = useCallback((durationMs = 180_000) => {
    externalPickerGraceUntilRef.current = Date.now() + durationMs;
  }, []);

  useEffect(() => {
    isPinSetRef.current = isPinSet;
  }, [isPinSet]);

  useEffect(() => {
    isTotpEnabledRef.current = isTotpEnabled;
  }, [isTotpEnabled]);

  useEffect(() => {
    isOsCredentialOnlyRef.current = isOsCredentialOnly;
  }, [isOsCredentialOnly]);

  useEffect(() => {
    pinLengthHintRef.current = pinLengthHint;
  }, [pinLengthHint]);

  const verifyNativeDeviceIntegrity = useCallback(async (): Promise<boolean> => {
    if (!isNativeAndroidSecureAuth()) return true;
    try {
      const res = await SecureAuth.checkDeviceIntegrity();
      if (res && res.secure === false) {
        clearSessionCryptoKey();
        pendingPinRef.current = null;
        setPendingTwoFactor(false);
        setActiveSessionPin(null);
        setIsUnlocked(false);
        setIsDeviceCompromised(true);
        setDeviceIntegrityReason(
          res.reason || '루팅 또는 보안 변조가 감지되어 앱을 실행할 수 없습니다.'
        );
        return false;
      }
    } catch {
      // Fail-closed if native integrity bridge fails unexpectedly on Android
    }
    return true;
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      verifyNativeDeviceIntegrity(),
      isPinConfigured(),
      getPinRequirements(),
      checkLockout(),
      checkBiometricAvailability({ allowDeviceCredential: false }),
      checkBiometricAvailability({ allowDeviceCredential: true }),
      getBiometricMeta(),
      getTotpMeta(),
    ])
      .then(([deviceOk, configured, pinReq, lockout, strongBioAvail, anyBioAvail, bioMeta, totpMeta]) => {
        if (!mounted) return;
        isPinSetRef.current = configured;
        isOsCredentialOnlyRef.current = pinReq.isOsCredentialOnly;
        pinLengthHintRef.current = pinReq.pinLength;
        setIsPinSet(configured);
        setPinLengthHint(pinReq.pinLength);
        setIsOsCredentialOnly(pinReq.isOsCredentialOnly);
        // Gate unlocked state behind both device integrity and configured PIN
        setIsUnlocked(deviceOk && !configured);
        if (lockout.isLocked) {
          setLockoutRemainingMs(lockout.remainingMs);
        }
        setIsBiometricAvailable(pinReq.isOsCredentialOnly ? anyBioAvail : strongBioAvail);
        setIsBiometricEnabled(Boolean(bioMeta && bioMeta.enabled));
        const totpOn = Boolean(totpMeta && totpMeta.enabled);
        isTotpEnabledRef.current = totpOn;
        setIsTotpEnabled(totpOn);
      })
      .catch(() => {
        if (!mounted) return;
        // Fail-closed on storage/initialization error
        setIsUnlocked(false);
      })
      .finally(() => {
        if (mounted) {
          setIsAuthReady(true);
        }
      });

    // Background Privacy Shield & Auto-lock / Re-entry Lock Listener (Feedback #5)
    const onAppBackground = () => {
      backgroundTimeRef.current = Date.now();
      setIsPrivacyMasked(true);
    };

    const onAppForeground = () => {
      setIsPrivacyMasked(false);
      verifyNativeDeviceIntegrity();
      const graceUntil = externalPickerGraceUntilRef.current;
      externalPickerGraceUntilRef.current = null;
      const inExternalPickerGrace = Boolean(graceUntil && Date.now() <= graceUntil);
      if (backgroundTimeRef.current && isPinSetRef.current) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        // Skip instant 1s re-lock once while returning from an active OS photo picker / biometric prompt
        if (!inExternalPickerGrace && (elapsed >= 1000 || elapsed >= AUTO_LOCK_TIMEOUT_MS)) {
          clearSessionCryptoKey();
          pendingPinRef.current = null;
          setPendingTwoFactor(false);
          setActiveSessionPin(null);
          setIsUnlocked(false);
          if (isNativeAndroidSecureAuth()) {
            SecureAuth.clearWebViewMemory().catch(() => {});
          }
        }
      }
      backgroundTimeRef.current = null;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        onAppBackground();
      } else {
        onAppForeground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let appStateHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        onAppBackground();
      } else {
        onAppForeground();
      }
    })
      .then((handle) => {
        appStateHandle = handle;
      })
      .catch((err) => {
        console.debug('CapApp appStateChange listener skipped:', err);
      });

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (appStateHandle) {
        appStateHandle.remove().catch(() => {});
      }
    };
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemainingMs <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemainingMs((prev) => {
        if (prev <= 1000) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemainingMs]);

  // Idle inactivity auto-lock to shrink runtime memory exposure window
  useEffect(() => {
    if (!isUnlocked || !isPinSet || typeof window === 'undefined') return;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        clearSessionCryptoKey();
        pendingPinRef.current = null;
        setPendingTwoFactor(false);
        setActiveSessionPin(null);
        setIsUnlocked(false);
        if (isNativeAndroidSecureAuth()) {
          SecureAuth.clearWebViewMemory().catch(() => {});
        }
      }, IDLE_LOCK_TIMEOUT_MS);
    };

    resetIdleTimer();
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [isUnlocked, isPinSet]);

  const establishNonExtractableSession = async (pin: string) => {
    const sessionSalt = await ensurePinSessionSalt();
    await initSessionCryptoKeyFromPin(pin, sessionSalt);
    await migratePinRecordsToSessionKey(pin);
    setActiveSessionPin(SESSION_KEY_TOKEN);
    setIsUnlocked(true);
  };

  const completePrimaryFactor = async (pin: string, bypassSecondFactor = false): Promise<boolean> => {
    if (isTotpEnabledRef.current && !bypassSecondFactor) {
      pendingPinRef.current = pin;
      setPendingTwoFactor(true);
      return false;
    }
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
    await establishNonExtractableSession(pin);
    return true;
  };

  const isEnUi = () =>
    typeof document !== 'undefined' && document.documentElement?.dataset?.lang === 'en';

  const buildPinFailureResult = (result: { lockoutMs?: number; remainingAttempts?: number }) => {
    if (result.lockoutMs) {
      setLockoutRemainingMs(result.lockoutMs);
      const secs = Math.ceil(result.lockoutMs / 1000);
      return {
        success: false,
        message: isEnUi()
          ? `Too many failed attempts. Try again in ${secs}s.`
          : `입력 횟수를 초과했습니다. ${secs}초 후 다시 시도해 주세요.`,
      };
    }
    const left = result.remainingAttempts ?? 0;
    return {
      success: false,
      message: isEnUi()
        ? `Incorrect PIN. (${left} attempts remaining)`
        : `PIN이 일치하지 않습니다. (남은 기회: ${left}회)`,
    };
  };

  const unlockApp = async (
    pin: string
  ): Promise<{ success: boolean; message?: string; requiresTwoFactor?: boolean }> => {
    if (isDeviceCompromised) {
      return { success: false, message: deviceIntegrityReason };
    }
    const result = await verifyAppPin(pin);
    if (result.success) {
      const fullyUnlocked = await completePrimaryFactor(pin, isUnlocked);
      return { success: true, requiresTwoFactor: !fullyUnlocked };
    }
    return buildPinFailureResult(result);
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    const res = await unlockApp(pin);
    return res.success;
  };

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (isDeviceCompromised || !isBiometricEnabled || lockoutRemainingMs > 0) {
      return false;
    }

    const result = await authenticateWithBiometrics({
      allowDeviceCredential: isOsCredentialOnlyRef.current,
      expectedPinLength: pinLengthHintRef.current,
    });
    if (result.success && result.pin) {
      await completePrimaryFactor(result.pin, isUnlocked);
      return true;
    }

    return false;
  }, [isDeviceCompromised, isBiometricEnabled, lockoutRemainingMs, isUnlocked]);

  const verifyTwoFactorAndUnlock = async (
    code: string
  ): Promise<{ success: boolean; usedRecovery?: boolean; message?: string }> => {
    const res = await verifyStoredTotpOrRecovery(code, pendingPinRef.current || undefined);
    if (!res.valid) {
      if (res.lockoutMs) {
        const secs = Math.ceil(res.lockoutMs / 1000);
        return {
          success: false,
          message: isEnUi()
            ? `Too many verification attempts. Try again in ${secs}s.`
            : `인증 시도 횟수를 초과했습니다. ${secs}초 후 다시 시도해 주세요.`,
        };
      }
      const attemptHint =
        typeof res.remainingAttempts === 'number'
          ? isEnUi()
            ? ` (${res.remainingAttempts} left)`
            : ` (남은 기회: ${res.remainingAttempts}회)`
          : '';
      return {
        success: false,
        message: isEnUi()
          ? `Invalid 2FA code or recovery code.${attemptHint}`
          : `2단계 인증 코드 또는 복구 코드가 일치하지 않습니다.${attemptHint}`,
      };
    }
    const pendingPin = pendingPinRef.current;
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
    if (pendingPin) {
      await establishNonExtractableSession(pendingPin);
    } else {
      setIsUnlocked(true);
    }
    return { success: true, usedRecovery: res.usedRecovery };
  };

  const cancelTwoFactor = () => {
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
  };

  const generateUnbiasedRandomDigits = (length: number): string => {
    const digits: string[] = [];
    while (digits.length < length) {
      const buf = crypto.getRandomValues(new Uint8Array(length * 2));
      for (let i = 0; i < buf.length && digits.length < length; i++) {
        // Rejection sampling (< 250) eliminates modulo bias for base-10 digits
        if (buf[i] < 250) {
          digits.push(String(buf[i] % 10));
        }
      }
    }
    return digits.join('');
  };

  const setupOsCredentialLockWithRecovery = async (): Promise<{ success: boolean; recoveryPin?: string }> => {
    if (!isBiometricAvailable) return { success: false };
    // Generate a strong 16-digit unbiased random internal PIN sealed by AndroidKeyStore
    const randomPin = generateUnbiasedRandomDigits(16);
    await reEncryptHealthData(randomPin, activeSessionPin || undefined);
    const sessionSalt = await setAppPin(randomPin, { isOsCredentialOnly: true });
    const enrolled = await enrollBiometrics(randomPin, { allowDeviceCredential: true });
    if (!enrolled) {
      await reEncryptHealthData(activeSessionPin || undefined, randomPin);
      if (!activeSessionPin) {
        await removeAppPin();
      }
      return { success: false };
    }
    await initSessionCryptoKeyFromPin(randomPin, sessionSalt);
    await migratePinRecordsToSessionKey(randomPin);
    setIsPinSet(true);
    setPinLengthHint(16);
    setIsOsCredentialOnly(true);
    setIsBiometricEnabled(true);
    setActiveSessionPin(SESSION_KEY_TOKEN);
    setIsUnlocked(true);
    return { success: true, recoveryPin: randomPin };
  };

  const setupOsCredentialLock = async (): Promise<boolean> => {
    const res = await setupOsCredentialLockWithRecovery();
    return res.success;
  };

  const enableTotp = async (secret: string, recoveryCodes: string[]) => {
    await enableTotp2FA(secret, recoveryCodes, activeSessionPin || undefined);
    isTotpEnabledRef.current = true;
    setIsTotpEnabled(true);
  };

  const disableTotp = async (
    verificationCode: string
  ): Promise<{ success: boolean; message?: string }> => {
    const res = await verifyStoredTotpOrRecovery(verificationCode, activeSessionPin || undefined);
    if (!res.valid) {
      if (res.lockoutMs) {
        const secs = Math.ceil(res.lockoutMs / 1000);
        return {
          success: false,
          message: isEnUi()
            ? `Too many attempts. Try again in ${secs}s.`
            : `시도 횟수를 초과했습니다. ${secs}초 후 다시 시도해 주세요.`,
        };
      }
      return {
        success: false,
        message: isEnUi()
          ? 'Invalid 2FA code or recovery code.'
          : '2단계 인증 코드 또는 복구 코드가 일치하지 않습니다.',
      };
    }
    await disableTotp2FA();
    isTotpEnabledRef.current = false;
    setIsTotpEnabled(false);
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
    return { success: true };
  };

  const toggleBiometric = async (enable: boolean, verifiedPin?: string): Promise<boolean> => {
    if (enable) {
      if (!isPinSet || !verifiedPin) {
        return false;
      }
      const ok = await enrollBiometrics(verifiedPin, {
        allowDeviceCredential: isOsCredentialOnlyRef.current,
      });
      if (ok) {
        setIsBiometricEnabled(true);
        return true;
      }
      return false;
    } else {
      await disableBiometrics();
      setIsBiometricEnabled(false);
      return true;
    }
  };

  const setupNewPin = async (pin: string): Promise<{ biometricSynced: boolean }> => {
    await reEncryptHealthData(pin, activeSessionPin || undefined);
    const sessionSalt = await setAppPin(pin, { isOsCredentialOnly: false });
    isOsCredentialOnlyRef.current = false;
    pinLengthHintRef.current = pin.length;
    await initSessionCryptoKeyFromPin(pin, sessionSalt);
    await migratePinRecordsToSessionKey(pin);
    let biometricSynced = true;
    if (isBiometricEnabled) {
      biometricSynced = await updateBiometricPinToken(pin);
      if (!biometricSynced) {
        // Keep KeyStore & UI consistent if user cancels biometric re-enrollment
        await disableBiometrics();
        setIsBiometricEnabled(false);
      }
    }
    setIsPinSet(true);
    setPinLengthHint(pin.length);
    setIsOsCredentialOnly(false);
    setIsBiometricAvailable(await checkBiometricAvailability({ allowDeviceCredential: false }));
    setActiveSessionPin(SESSION_KEY_TOKEN);
    setIsUnlocked(true);
    return { biometricSynced };
  };

  const disablePin = async () => {
    await reEncryptHealthData(undefined, activeSessionPin || undefined);
    await removeAppPin();
    await disableBiometrics();
    await disableTotp2FA();
    clearSessionCryptoKey();
    setIsBiometricEnabled(false);
    isTotpEnabledRef.current = false;
    setIsTotpEnabled(false);
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
    setIsPinSet(false);
    setPinLengthHint(FIXED_PIN_LENGTH);
    setIsOsCredentialOnly(false);
    setActiveSessionPin(null);
    setIsUnlocked(true);
  };

  const verifySensitiveActionPin = async (
    pin: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (isDeviceCompromised) {
      return { success: false, message: deviceIntegrityReason };
    }
    const result = await verifyAppPin(pin);
    if (result.success) {
      return { success: true };
    }
    return buildPinFailureResult(result);
  };

  const verifySensitiveActionBiometric = async (): Promise<boolean> => {
    if (isDeviceCompromised || !isBiometricEnabled || lockoutRemainingMs > 0) {
      return false;
    }
    beginExternalPickerGrace(120_000);
    try {
      const result = await authenticateWithBiometrics({
        allowDeviceCredential: isOsCredentialOnlyRef.current,
        expectedPinLength: pinLengthHintRef.current,
      });
      return Boolean(result.success && result.pin);
    } finally {
      externalPickerGraceUntilRef.current = null;
    }
  };

  const lockApp = () => {
    if (isPinSet) {
      clearSessionCryptoKey();
      pendingPinRef.current = null;
      setPendingTwoFactor(false);
      setActiveSessionPin(null);
      setIsUnlocked(false);
      if (isNativeAndroidSecureAuth()) {
        SecureAuth.clearWebViewMemory().catch(() => {});
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthReady,
        isUnlocked,
        isPinSet,
        isDeviceCompromised,
        deviceIntegrityReason,
        pinLengthHint,
        isOsCredentialOnly,
        activeSessionPin,
        lockoutRemainingMs,
        isPrivacyMasked,
        isBiometricAvailable,
        isBiometricEnabled,
        isTotpEnabled,
        pendingTwoFactor,
        unlockApp,
        unlockWithPin,
        unlockWithBiometric,
        verifyTwoFactorAndUnlock,
        cancelTwoFactor,
        toggleBiometric,
        setupOsCredentialLock,
        setupOsCredentialLockWithRecovery,
        enableTotp,
        disableTotp,
        setupNewPin,
        disablePin,
        lockApp,
        beginExternalPickerGrace,
        verifySensitiveActionPin,
        verifySensitiveActionBiometric,
      }}
    >
      {/* Privacy Mask for App Switcher */}
      {isPrivacyMasked && isPinSet && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center text-white p-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-black">
              🔒
            </div>
            <p className="font-bold text-sm">
              {typeof window !== 'undefined' && document.documentElement.dataset.lang === 'en'
                ? 'Privacy Shield Active'
                : '보안 모드 실행 중'}
            </p>
            <p className="text-xs text-slate-400">
              {typeof window !== 'undefined' && document.documentElement.dataset.lang === 'en'
                ? 'Screen hidden to protect medical data.'
                : '의료 데이터 보호를 위해 화면을 가립니다.'}
            </p>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
