import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { useAcutePain } from '../context/AcutePainContext';
import { useSettings } from '../context/SettingsContext';
import { triggerHaptic } from '../utils/native';

const DOUBLE_BACK_EXIT_WINDOW_MS = 2000;

/**
 * Shared double-back-to-exit handler with toast prompt for Android hardware back button.
 */
function useDoubleBackExit(onFirstPress: () => void) {
  const lastBackPressRef = useRef<number>(0);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastBackPressRef.current < DOUBLE_BACK_EXIT_WINDOW_MS) {
      CapApp.exitApp().catch(() => {
        // Safe no-op in non-native browser environments
      });
      return;
    }

    lastBackPressRef.current = now;
    triggerHaptic();
    onFirstPress();
  }, [onFirstPress]);
}

const BackExitToast: React.FC<{ visible: boolean; message: string }> = ({ visible, message }) => {
  if (!visible) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2.5 rounded-full bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-bold shadow-xl border border-slate-700 whitespace-nowrap animate-in fade-in"
    >
      {message}
    </div>
  );
};

/**
 * Hardware back button handler while LockScreen or auth gate is active (never leaks routes).
 */
export const LockedBackButtonHandler: React.FC = () => {
  const { t } = useSettings();
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPrompt = useCallback(() => {
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), DOUBLE_BACK_EXIT_WINDOW_MS);
  }, []);

  const handleExitAttempt = useDoubleBackExit(showPrompt);

  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', () => {
      handleExitAttempt();
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch(() => {});

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (listenerHandle) listenerHandle.remove().catch(() => {});
    };
  }, [handleExitAttempt]);

  return <BackExitToast visible={showToast} message={t('backExitPrompt')} />;
};

/**
 * Hardware back button handler for authenticated app routes and modals.
 */
export const BackButtonHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isOpen: isAcuteOpen, closeAcute } = useAcutePain();
  const { t } = useSettings();
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPrompt = useCallback(() => {
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), DOUBLE_BACK_EXIT_WINDOW_MS);
  }, []);

  const handleExitAttempt = useDoubleBackExit(showPrompt);

  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (isAcuteOpen) {
        closeAcute();
        return;
      }

      if (location.pathname !== '/') {
        if (canGoBack) {
          navigate(-1);
        } else {
          navigate('/', { replace: true });
        }
        return;
      }

      handleExitAttempt();
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch(() => {});

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (listenerHandle) listenerHandle.remove().catch(() => {});
    };
  }, [isAcuteOpen, closeAcute, location.pathname, navigate, handleExitAttempt]);

  return <BackExitToast visible={showToast} message={t('backExitPrompt')} />;
};

export default BackButtonHandler;
