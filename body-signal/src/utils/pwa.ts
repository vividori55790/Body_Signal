import { Capacitor } from '@capacitor/core';

/**
 * Prevents PWA Workbox service worker caching from serving stale web bundles across
 * Android APK upgrades, while preserving standard SW registration on web builds.
 */
export async function setupServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k.startsWith('workbox-') || k.includes('precache'))
            .map((k) => caches.delete(k))
        );
      }
    } catch (err) {
      console.debug('Native SW cleanup skipped:', err);
    }
    return;
  }

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
        console.debug('Web SW registration skipped:', err);
      });
    });
  }
}
