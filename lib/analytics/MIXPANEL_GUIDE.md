# Mixpanel Analytics Integration

This document explains how Mixpanel is integrated and how to add new tracking events.

## Setup

- **Package**: `mixpanel-browser` (installed via npm)
- **Token**: `4b8f3452a4d2facfa4855ddf053dd5f9`
- **Initialization**: Automatic on first page load via `usePageView()` hook in root layout
- **Geolocation**: Automatically collected from `ipapi.co` (IP-based location)

## Current Events Tracked

### 1. Page Views (Automatic)
- **Event Name**: `Page View`
- **Triggered**: When user navigates to a different page
- **Data Captured**:
  - `page_path` - Current URL path
  - `timestamp` - When the page was viewed
  - Geolocation data (country, city, region, IP, timezone) - added automatically

**Where**: Root layout via `usePageView()` hook in `app/layout.tsx`

### 2. Game Viewed
- **Event Name**: `game_viewed`
- **Triggered**: When user clicks on a game card or spinner completes
- **Data Captured**:
  - `game_id` - Unique game ID
  - `game_name` - Name of the game
  - `timestamp` - When viewed
  - Geolocation data - added automatically

**Where**: `app/games/page.tsx` in `handleGameCardClick()` and `handleSpinnerComplete()` functions

### 3. Advanced Filters Selected
- **Event Name**: `advanced_filters_selected`
- **Triggered**: When user applies filters via the advanced filters modal
- **Data Captured**:
  - `filters_applied` - Array of active filter names
  - `filter_count` - Number of active filters
  - `timestamp` - When filters were applied
  - Geolocation data - added automatically
  - Plus details of individual filters (search, categories, player count, year range, complexity, best player count)

**Where**: `app/games/page.tsx` in `handleApplyAdvancedFilters()` function

### 4. Special Filter Count
- **Event Name**: `special_filter_count`
- **Triggered**: When user applies filters (same as advanced_filters_selected)
- **Data Captured**:
  - `active_filter_count` - Total number of active filters
  - `active_filters` - Array of filter names currently active
  - `timestamp` - When tracked
  - Geolocation data - added automatically

**Where**: `app/games/page.tsx` in `handleApplyAdvancedFilters()` function

## How to Add New Events

### 1. Define the tracking function in `lib/analytics/mixpanel.ts`

```typescript
export function trackMyEvent(data: string) {
  if (!isInitialized) return;

  mixpanel.track('my_event', {
    custom_data: data,
    timestamp: new Date().toISOString(),
  });
}
```

### 2. Import and use in your component

```typescript
import { trackMyEvent } from '@/lib/analytics/mixpanel';

// In your component or handler
trackMyEvent('my custom value');
```

## Key Functions

All functions are in `lib/analytics/mixpanel.ts`:

- `initMixpanel()` - Initializes Mixpanel (called automatically)
- `trackPageView(pagePath)` - Track page views (called automatically)
- `trackGameViewed(gameId, gameName)` - Track game views
- `trackAdvancedFiltersSelected(filters)` - Track filter application
- `trackSpecialFilterCount(count, filterNames)` - Track number of active filters
- `trackEvent(eventName, properties)` - Generic event tracking
- `setUserProperties(properties)` - Set user-level properties
- `identifyUser(userId)` - Identify a specific user

## Viewing Analytics

1. Go to [mixpanel.com](https://mixpanel.com)
2. Login to your account
3. Navigate to **Reports** → **Events** to see tracked events
4. Use **Funnels** to track user flows (e.g., page view → game viewed)
5. Use **Cohorts** to segment users by behavior/location

## Best Practices

- ✅ Only track events that provide value (don't spam)
- ✅ Use descriptive event names (snake_case)
- ✅ Include relevant context in event properties
- ✅ Never track sensitive data (passwords, IDs, personal info)
- ✅ Test tracking in development (console.log shows events when `NODE_ENV === 'development'`)

## Testing Locally

1. Run `npm run dev`
2. Open browser console (F12)
3. Navigate and interact with the app
4. When `NODE_ENV=development`, Mixpanel logs to console with `[Mixpanel]` prefix

## Troubleshooting

### Events not showing in Mixpanel dashboard
- Check that Mixpanel token is correct: `4b8f3452a4d2facfa4855ddf053dd5f9`
- Ensure browser allows analytics (check console for errors)
- Wait 5-10 minutes for events to appear in dashboard
- Check that Mixpanel is initialized (should happen on first page load)

### Geolocation not working
- Geolocation comes from `ipapi.co` which is IP-based (no user permission needed)
- Check network tab to see if request to `https://ipapi.co/json/` succeeds
- If it fails, events will still be tracked but without geolocation data
