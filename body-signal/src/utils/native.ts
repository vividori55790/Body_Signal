import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Trigger subtle haptic feedback for mobile interactions
 */
export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  try {
    await Haptics.impact({ style });
  } catch {
    // Graceful fallback for web/desktop
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
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
