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

interface AuthContextValue {
  isAuthReady: boolean;
  isUnlocked: boolean;
  isPinSet: boolean;
  activeSessionPin: string | null;
  lockoutRemainingMs: number;
  isPrivacyMasked: boolean;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  unlockApp: (pin: string) => Promise<{ success: boolean; message?: string }>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  toggleBiometric: (enable: boolean) => Promise<boolean>;
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

  const backgroundTimeRef = useRef<number | null>(null);
  const isPinSetRef = useRef<boolean>(false);

  useEffect(() => {
    isPinSetRef.current = isPinSet;
  }, [isPinSet]);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      isPinConfigured(),
      checkLockout(),
      checkBiometricAvailability(),
      getBiometricMeta(),
    ])
      .then(([configured, lockout, bioAvail, bioMeta]) => {
        if (!mounted) return;
        isPinSetRef.current = configured;
        setIsPinSet(configured);
        setIsUnlocked(!configured);
        if (lockout.isLocked) {
          setLockoutRemainingMs(lockout.remainingMs);
        }
        setIsBiometricAvailable(bioAvail);
        setIsBiometricEnabled(Boolean(bioMeta && bioMeta.enabled));
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

  const unlockApp = async (pin: string): Promise<{ success: boolean; message?: string }> => {
    const result = await verifyAppPin(pin);
    if (result.success) {
      setActiveSessionPin(pin);
      setIsUnlocked(true);
      return { success: true };
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
      setActiveSessionPin(result.pin);
      setIsUnlocked(true);
      return true;
    }

    return false;
  }, [isBiometricEnabled, lockoutRemainingMs]);

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
    setIsBiometricEnabled(false);
    setIsPinSet(false);
    setActiveSessionPin(null);
    setIsUnlocked(true);
  };

  const lockApp = () => {
    if (isPinSet) {
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
        unlockApp,
        unlockWithPin,
        unlockWithBiometric,
        toggleBiometric,
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
