import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { isPinConfigured, verifyAppPin, setAppPin, removeAppPin, checkLockout } from '../utils/pin';
import { reEncryptHealthData } from '../utils/storage';

interface AuthContextValue {
  isUnlocked: boolean;
  isPinSet: boolean;
  activeSessionPin: string | null;
  lockoutRemainingMs: number;
  isPrivacyMasked: boolean;
  unlockApp: (pin: string) => Promise<{ success: boolean; message?: string }>;
  setupNewPin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  lockApp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Auto-lock timeout when backgrounded (default 60 seconds)
const AUTO_LOCK_TIMEOUT_MS = 60_000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isPinSet, setIsPinSet] = useState(false);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(false);

  const backgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    isPinConfigured().then((configured) => {
      setIsPinSet(configured);
      if (configured) {
        setIsUnlocked(false);
      }
    });

    // Check lockout on start
    checkLockout().then(({ isLocked, remainingMs }) => {
      if (isLocked) {
        setLockoutRemainingMs(remainingMs);
      }
    });

    // Background Privacy Shield & Auto-lock Listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        backgroundTimeRef.current = Date.now();
        setIsPrivacyMasked(true);
      } else {
        setIsPrivacyMasked(false);
        if (backgroundTimeRef.current && isPinSet) {
          const elapsed = Date.now() - backgroundTimeRef.current;
          if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
            setActiveSessionPin(null);
            setIsUnlocked(false);
          }
        }
        backgroundTimeRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPinSet]);

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

  const setupNewPin = async (pin: string) => {
    await reEncryptHealthData(pin, activeSessionPin || undefined);
    await setAppPin(pin);
    setIsPinSet(true);
    setActiveSessionPin(pin);
    setIsUnlocked(true);
  };

  const disablePin = async () => {
    await reEncryptHealthData(undefined, activeSessionPin || undefined);
    await removeAppPin();
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
        isUnlocked,
        isPinSet,
        activeSessionPin,
        lockoutRemainingMs,
        isPrivacyMasked,
        unlockApp,
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
