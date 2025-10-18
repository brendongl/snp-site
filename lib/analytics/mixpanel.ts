import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel (client-side only)
const MIXPANEL_TOKEN = '4b8f3452a4d2facfa4855ddf053dd5f9';

let isInitialized = false;

export async function initMixpanel() {
  if (typeof window === 'undefined' || isInitialized) return;

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: false, // We'll handle this manually
      persistence: 'localStorage',
    });
    isInitialized = true;

    // Get geolocation data and set as user properties
    await setGeolocationProperties();
  } catch (error) {
    console.error('Failed to initialize Mixpanel:', error);
  }
}

// Fetch geolocation data from IP-based service
async function setGeolocationProperties() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    mixpanel.register({
      $country: data.country_name || 'Unknown',
      $city: data.city || 'Unknown',
      $region: data.region || 'Unknown',
      ip_address: data.ip || 'Unknown',
      timezone: data.timezone || 'Unknown',
    });
  } catch (error) {
    console.warn('Failed to fetch geolocation:', error);
    // Silently fail - analytics shouldn't break the app
  }
}

// Track page views
export function trackPageView(pagePath: string) {
  if (!isInitialized) return;

  mixpanel.track('Page View', {
    page_path: pagePath,
    timestamp: new Date().toISOString(),
  });
}

// Track when a game is viewed
export function trackGameViewed(gameId: string, gameName: string) {
  if (!isInitialized) return;

  mixpanel.track('game_viewed', {
    game_id: gameId,
    game_name: gameName,
    timestamp: new Date().toISOString(),
  });
}

// Track when advanced filters are selected
export function trackAdvancedFiltersSelected(filters: Record<string, any>) {
  if (!isInitialized) return;

  mixpanel.track('advanced_filters_selected', {
    filters_applied: Object.keys(filters).filter((key) => filters[key]),
    filter_count: Object.keys(filters).filter((key) => filters[key]).length,
    timestamp: new Date().toISOString(),
  });
}

// Track special filter count (e.g., how many quick filters are active)
export function trackSpecialFilterCount(count: number, filterNames: string[]) {
  if (!isInitialized) return;

  mixpanel.track('special_filter_count', {
    active_filter_count: count,
    active_filters: filterNames,
    timestamp: new Date().toISOString(),
  });
}

// Generic event tracking for future use
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (!isInitialized) return;

  mixpanel.track(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

// Set user properties (optional, for cohort analysis)
export function setUserProperties(properties: Record<string, any>) {
  if (!isInitialized) return;

  mixpanel.register(properties);
}

// Identify user (optional, if you have user IDs)
export function identifyUser(userId: string) {
  if (!isInitialized) return;

  mixpanel.identify(userId);
}
