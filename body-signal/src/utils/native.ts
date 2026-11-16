import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

export { ImpactStyle };

const HAPTICS_STORAGE_KEY = 'bignal_haptics_enabled';

const getStoredHapticsPreference = (): boolean => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const explicit = localStorage.getItem(HAPTICS_STORAGE_KEY);
      if (explicit !== null) {
        return explicit === 'true';
      }
      const settingsStr = localStorage.getItem('bignal_settings_v1') || localStorage.getItem('bignal_settings');
      if (settingsStr) {
        const parsed = JSON.parse(settingsStr);
        if (typeof parsed.hapticsEnabled === 'boolean') {
          return parsed.hapticsEnabled;
        }
      }
    } catch {
      // Safe fallback on storage access error
    }
  }
  return true;
};

let hapticsEnabledState = getStoredHapticsPreference();

/**
 * Configure global haptic feedback permission state.
 * When set to false, all vibrations are suppressed across native and web layers.
 */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabledState = Boolean(enabled);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(HAPTICS_STORAGE_KEY, String(hapticsEnabledState));
    } catch {
      // Safe fallback
    }
  }
}

/**
 * Query current global haptic feedback permission state.
 */
export function isHapticsEnabled(): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const explicit = localStorage.getItem(HAPTICS_STORAGE_KEY);
      if (explicit !== null) {
        return explicit === 'true' && hapticsEnabledState;
      }
    } catch {
      // Safe fallback
    }
  }
  return hapticsEnabledState;
}

/**
 * Trigger subtle haptic feedback for mobile interactions.
 * Centralized guard ensures strict compliance with user and system vibration settings.
 */
export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!hapticsEnabledState || !isHapticsEnabled()) {
    return;
  }

  const effectiveStyle = style || ImpactStyle.Light;

  try {
    await Haptics.impact({ style: effectiveStyle });
  } catch {
    // Graceful fallback for web/desktop when vibration is supported and enabled
    if (hapticsEnabledState && isHapticsEnabled() && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Safe no-op if blocked by browser policy
      }
    }
  }
}


/**
 * Schedule daily recurring reminder
 */
export async function scheduleDailyReminder(time: string, title = '바디 시그널 알림', body = '오늘의 통증과 복용 약물을 기록해 보세요.'): Promise<boolean> {
  try {
    const [hoursStr, minutesStr] = time.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      return false;
    }

    // Cancel existing reminder
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });

    // Schedule notification
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1001,
          title,
          body,
          schedule: {
            on: {
              hour: hours,
              minute: minutes,
            },
            allowWhileIdle: true,
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.warn('LocalNotifications scheduling failed (web fallback):', err);
    return false;
  }
}

/**
 * Cancel daily reminder
 */
export async function cancelDailyReminder(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
  } catch (err) {
    console.warn('Cancel notification error:', err);
  }
}
