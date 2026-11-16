import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { isPinConfigured, verifyAppPin, setAppPin, removeAppPin, checkLockout } from '../utils/pin';
import { reEncryptHealthData } from '../utils/storage';
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
  toggleBiometric: (enable: boolean) => Promise<boolean>;
  setupOsCredentialLock: () => Promise<boolean>;
  enableTotp: (secret: string, recoveryCodes: string[]) => Promise<void>;
  disableTotp: () => Promise<void>;
  setupNewPin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  lockApp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Auto-lock timeout when backgrounded (default 60 seconds)
const AUTO_LOCK_TIMEOUT_MS = 60_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPinSet, setIsPinSet] = useState(false);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isTotpEnabled, setIsTotpEnabled] = useState(false);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(false);

  const backgroundTimeRef = useRef<number | null>(null);
  const isPinSetRef = useRef<boolean>(false);
  const isTotpEnabledRef = useRef<boolean>(false);
  const pendingPinRef = useRef<string | null>(null);

  useEffect(() => {
    isPinSetRef.current = isPinSet;
  }, [isPinSet]);

  useEffect(() => {
    isTotpEnabledRef.current = isTotpEnabled;
  }, [isTotpEnabled]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      isPinConfigured(),
      checkLockout(),
      checkBiometricAvailability(),
      getBiometricMeta(),
      getTotpMeta(),
    ])
      .then(([configured, lockout, bioAvail, bioMeta, totpMeta]) => {
        if (!mounted) return;
        isPinSetRef.current = configured;
        setIsPinSet(configured);
        setIsUnlocked(!configured);
        if (lockout.isLocked) {
          setLockoutRemainingMs(lockout.remainingMs);
        }
        setIsBiometricAvailable(bioAvail);
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
      if (backgroundTimeRef.current && isPinSetRef.current) {
        const elapsed = Date.now() - backgroundTimeRef.current;
        // When leaving and returning to app (after 1s or timeout), require PIN/Biometric
        if (elapsed >= 1000 || elapsed >= AUTO_LOCK_TIMEOUT_MS) {
          pendingPinRef.current = null;
          setPendingTwoFactor(false);
          setActiveSessionPin(null);
          setIsUnlocked(false);
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

  const completePrimaryFactor = (pin: string, bypassSecondFactor = false): boolean => {
    if (isTotpEnabledRef.current && !bypassSecondFactor) {
      pendingPinRef.current = pin;
      setPendingTwoFactor(true);
      return false;
    }
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
    setActiveSessionPin(pin);
    setIsUnlocked(true);
    return true;
  };

  const unlockApp = async (
    pin: string
  ): Promise<{ success: boolean; message?: string; requiresTwoFactor?: boolean }> => {
    const result = await verifyAppPin(pin);
    if (result.success) {
      const fullyUnlocked = completePrimaryFactor(pin, isUnlocked);
      return { success: true, requiresTwoFactor: !fullyUnlocked };
    }

    if (result.lockoutMs) {
      setLockoutRemainingMs(result.lockoutMs);
      return {
        success: false,
        message: `입력 횟수를 초과했습니다. ${Math.ceil(result.lockoutMs / 1000)}초 후 다시 시도해 주세요.`,
      };
    }

    return {
      success: false,
      message: `PIN이 일치하지 않습니다. (남은 기회: ${result.remainingAttempts ?? 0}회)`,
    };
  };

  const unlockWithPin = async (pin: string): Promise<boolean> => {
    const res = await unlockApp(pin);
    return res.success;
  };

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!isBiometricEnabled || lockoutRemainingMs > 0) {
      return false;
    }

    const result = await authenticateWithBiometrics();
    if (result.success && result.pin) {
      completePrimaryFactor(result.pin, isUnlocked);
      return true;
    }

    return false;
  }, [isBiometricEnabled, lockoutRemainingMs, isUnlocked]);

  const verifyTwoFactorAndUnlock = async (
    code: string
  ): Promise<{ success: boolean; usedRecovery?: boolean; message?: string }> => {
    const res = await verifyStoredTotpOrRecovery(code);
    if (!res.valid) {
      return {
        success: false,
        message: '2단계 인증 코드 또는 복구 코드가 일치하지 않습니다.',
      };
    }
    if (pendingPinRef.current) {
      setActiveSessionPin(pendingPinRef.current);
      pendingPinRef.current = null;
    }
    setPendingTwoFactor(false);
    setIsUnlocked(true);
    return { success: true, usedRecovery: res.usedRecovery };
  };

  const cancelTwoFactor = () => {
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
  };

  const setupOsCredentialLock = async (): Promise<boolean> => {
    if (!isBiometricAvailable) return false;
    // Generate a strong 16-digit cryptographically random internal PIN sealed by AndroidKeyStore
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const randomPin = Array.from(bytes, (b) => String(b % 10)).join('');
    await reEncryptHealthData(randomPin, activeSessionPin || undefined);
    await setAppPin(randomPin);
    const enrolled = await enrollBiometrics(randomPin);
    if (!enrolled) {
      await reEncryptHealthData(activeSessionPin || undefined, randomPin);
      if (!activeSessionPin) {
        await removeAppPin();
      }
      return false;
    }
    setIsPinSet(true);
    setIsBiometricEnabled(true);
    setActiveSessionPin(randomPin);
    setIsUnlocked(true);
    return true;
  };

  const enableTotp = async (secret: string, recoveryCodes: string[]) => {
    await enableTotp2FA(secret, recoveryCodes);
    isTotpEnabledRef.current = true;
    setIsTotpEnabled(true);
  };

  const disableTotp = async () => {
    await disableTotp2FA();
    isTotpEnabledRef.current = false;
    setIsTotpEnabled(false);
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
  };

  const toggleBiometric = async (enable: boolean): Promise<boolean> => {
    if (enable) {
      if (!isPinSet || !activeSessionPin) {
        return false;
      }
      const ok = await enrollBiometrics(activeSessionPin);
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

  const setupNewPin = async (pin: string) => {
    await reEncryptHealthData(pin, activeSessionPin || undefined);
    await setAppPin(pin);
    if (isBiometricEnabled) {
      await updateBiometricPinToken(pin);
    }
    setIsPinSet(true);
    setActiveSessionPin(pin);
    setIsUnlocked(true);
  };

  const disablePin = async () => {
    await reEncryptHealthData(undefined, activeSessionPin || undefined);
    await removeAppPin();
    await disableBiometrics();
    await disableTotp2FA();
    setIsBiometricEnabled(false);
    isTotpEnabledRef.current = false;
    setIsTotpEnabled(false);
    pendingPinRef.current = null;
    setPendingTwoFactor(false);
    setIsPinSet(false);
    setActiveSessionPin(null);
    setIsUnlocked(true);
  };

  const lockApp = () => {
    if (isPinSet) {
      pendingPinRef.current = null;
      setPendingTwoFactor(false);
      setActiveSessionPin(null);
      setIsUnlocked(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthReady,
        isUnlocked,
        isPinSet,
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
        enableTotp,
        disableTotp,
        setupNewPin,
        disablePin,
        lockApp,
      }}
    >
      {/* Privacy Mask for App Switcher */}
      {isPrivacyMasked && isPinSet && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center text-white p-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-black">
              🔒
            </div>
            <p className="font-bold text-sm">보안 모드 실행 중</p>
            <p className="text-xs text-slate-400">의료 데이터 보호를 위해 화면을 가립니다.</p>
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
