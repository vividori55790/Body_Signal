import React, { createContext, useContext, useState, useEffect } from 'react';
import { isPinConfigured, verifyAppPin, setAppPin, removeAppPin, checkLockout } from '../utils/pin';

interface AuthContextValue {
  isUnlocked: boolean;
  isPinSet: boolean;
  activeSessionPin: string | null;
  lockoutRemainingMs: number;
  unlockApp: (pin: string) => Promise<{ success: boolean; message?: string }>;
  setupNewPin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  lockApp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isPinSet, setIsPinSet] = useState(false);
  const [activeSessionPin, setActiveSessionPin] = useState<string | null>(null);
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);

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

  const setupNewPin = async (pin: string) => {
    await setAppPin(pin);
    setIsPinSet(true);
    setActiveSessionPin(pin);
    setIsUnlocked(true);
  };

  const disablePin = async () => {
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
        unlockApp,
        setupNewPin,
        disablePin,
        lockApp,
      }}
    >
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
