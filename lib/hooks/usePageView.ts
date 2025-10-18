import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initMixpanel, trackPageView } from '@/lib/analytics/mixpanel';

/**
 * Hook to initialize Mixpanel and track page views
 * Use this once in your root layout
 */
export function usePageView() {
  const pathname = usePathname();

  useEffect(() => {
    // Initialize Mixpanel on first load
    initMixpanel();
  }, []);

  useEffect(() => {
    // Track page view whenever pathname changes
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);
}
