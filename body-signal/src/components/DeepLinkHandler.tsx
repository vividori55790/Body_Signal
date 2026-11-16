import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp, URLOpenListenerEvent } from '@capacitor/app';
import { useAcutePain } from '../context/AcutePainContext';

export const DeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();
  const { openAcute } = useAcutePain();

  const handleDeepLink = useCallback(
    (urlString: string) => {
      if (!urlString) return;

      try {
        const url = new URL(urlString);
        const search = url.search || '';
        const pathname = url.pathname || '';

        // Priority 1: When URL contains ?mode=acute or path /acute, call openAcute()
        if (
          url.searchParams.get('mode') === 'acute' ||
          search.includes('mode=acute') ||
          pathname === '/acute' ||
          pathname.endsWith('/acute')
        ) {
          openAcute();
          return;
        }

        // Priority 2: When URL contains /briefing, navigate to /briefing
        if (pathname === '/briefing' || pathname.endsWith('/briefing') || urlString.includes('/briefing')) {
          navigate('/briefing');
          return;
        }

        // Priority 3: When URL contains /entry, navigate to /entry
        if (pathname === '/entry' || pathname.endsWith('/entry') || urlString.includes('/entry')) {
          navigate('/entry');
          return;
        }

        // Fallback: general pathname navigation if specified
        const target = pathname + search;
        if (target && target !== '/' && target !== '') {
          navigate(target);
        }
      } catch {
        // Fallback for custom or relative schemes that URL constructor cannot parse
        if (urlString.includes('?mode=acute') || urlString.includes('/acute')) {
          openAcute();
        } else if (urlString.includes('/briefing')) {
          navigate('/briefing');
        } else if (urlString.includes('/entry')) {
          navigate('/entry');
        }
      }
    },
    [navigate, openAcute]
  );

  useEffect(() => {
    // 1. Cold start launch URL check
    CapApp.getLaunchUrl()
      .then((launchUrl) => {
        if (launchUrl?.url) {
          handleDeepLink(launchUrl.url);
        }
      })
      .catch((err) => {
        console.debug('DeepLink getLaunchUrl error or web environment:', err);
      });

    // 2. Warm start listener (app open while in background)
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    CapApp.addListener('appUrlOpen', (data: URLOpenListenerEvent) => {
      if (data?.url) {
        handleDeepLink(data.url);
      }
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch((err) => {
        console.debug('DeepLink addListener error or web environment:', err);
      });

    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [handleDeepLink]);

  return null;
};

export default DeepLinkHandler;
