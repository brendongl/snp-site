# Caching System

The caching system eliminates repeated calls to the Airtable API by storing data locally on the server in JSON files.

## Overview

**Problem:** Airtable API has rate limits and calling it on every page load is slow and wasteful.

**Solution:** Cache data on the server's filesystem and only call Airtable when explicitly refreshed by staff.

## Architecture

### Cache Storage

**Location:** `data/` directory (relative to project root)

**Files:**
- `games-cache.json` - Board game records
- `content-checks-cache.json` - Content check records

**Structure:**
```json
{
  "games": [...],
  "lastUpdated": "2025-01-16T10:30:00.000Z"
}
```

### Cache Flow

#### First Load (Cache Miss)
```
User visits /games
  ↓
GET /api/games
  ↓
Check cache file exists? → NO
  ↓
Fetch from Airtable
  ↓
Write to cache file
  ↓
Return games to client
```

#### Subsequent Loads (Cache Hit)
```
User visits /games
  ↓
GET /api/games
  ↓
Check cache file exists? → YES
  ↓
Read from cache file
  ↓
Return games to client (instant!)
```

#### Manual Refresh
```
Staff clicks "Refresh Data"
  ↓
POST /api/games/refresh
  ↓
Fetch from Airtable
  ↓
Overwrite cache file
  ↓
Return success + timestamp
  ↓
Client refetches games
  ↓
Updated data displayed
```

## Implementation

### Cache Functions

**Location:** `lib/cache/games-cache.ts`

#### Games Cache

```typescript
// Read games from cache (returns null if not found)
function getCachedGames(): BoardGame[] | null

// Write games to cache
function setCachedGames(games: BoardGame[]): void

// Get cache metadata (timestamp and count)
function getCacheMetadata(): { lastUpdated: string | null; count: number }
```

#### Content Checks Cache

```typescript
// Read content checks from cache
function getCachedContentChecks(): ContentCheck[] | null

// Write content checks to cache
function setCachedContentChecks(checks: ContentCheck[]): void

// Get cache metadata
function getContentChecksCacheMetadata(): { lastUpdated: string | null; count: number }
```

### API Routes

#### GET /api/games
**Location:** `app/api/games/route.ts`

```typescript
export async function GET(request: Request) {
  // Try cache first
  let allGames = getCachedGames();

  if (!allGames) {
    // Cache miss - fetch from Airtable
    allGames = await gamesService.getAllGames();
    setCachedGames(allGames);
  }

  return NextResponse.json({
    games: allGames,
    totalCount: allGames.length,
    categories: extractCategories(allGames),
  });
}
```

#### POST /api/games/refresh
**Location:** `app/api/games/refresh/route.ts`

```typescript
export async function POST() {
  const oldCache = getCacheMetadata();

  // Fetch fresh data
  const games = await gamesService.getAllGames();

  // Update cache
  setCachedGames(games);

  return NextResponse.json({
    success: true,
    count: games.length,
    previousUpdate: oldCache.lastUpdated,
    currentUpdate: new Date().toISOString(),
  });
}
```

## File System Details

### Directory Creation

Cache directory is automatically created if it doesn't exist:

```typescript
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}
```

### File Writing

Cache is written with pretty formatting for readability:

```typescript
fs.writeFileSync(
  CACHE_FILE,
  JSON.stringify(cache, null, 2),
  'utf-8'
);
```

### Error Handling

All cache operations have try-catch blocks:

```typescript
try {
  // Cache operation
} catch (error) {
  console.error('Error reading cache:', error);
  return null; // Graceful degradation
}
```

If cache read fails, the system falls back to fetching from Airtable.

## Cache Metadata

Each cache file stores:

1. **Data:** The actual records (games or content checks)
2. **Timestamp:** When cache was last updated (ISO 8601 format)

This metadata allows:
- Displaying "Last updated" to users
- Comparing previous/current update times
- Debugging cache issues

## Benefits

### Performance
- **First load:** ~2-3 seconds (Airtable API call)
- **Subsequent loads:** ~50-200ms (file read)
- **10-60x faster** after first load

### Reliability
- No rate limit issues
- Works even if Airtable is slow
- Graceful degradation if cache fails

### Cost
- Fewer API calls = lower risk of hitting limits
- No additional hosting costs (uses local filesystem)

### User Experience
- Near-instant page loads
- No waiting for API on every visit
- Consistent performance

## Cache Invalidation

### When to Refresh Cache

Staff should manually refresh when:
- New games added to Airtable
- Game information updated
- Content checks added
- Images changed
- Any data changes that should be reflected on website

### Refresh Process

1. Staff visits `/games?staff=true`
2. Clicks "Refresh Data" button
3. Loading indicator shows
4. API call completes
5. Page refetches data
6. Updated games displayed

### Refresh Frequency

Recommended:
- **After adding new games:** Immediate refresh
- **After bulk updates:** Immediate refresh
- **Daily checks:** Optional (if frequent changes)
- **Before events:** Ensure data is current

## Limitations

### No Real-Time Updates

Cache means the website shows stale data until manually refreshed.

**Not a problem because:**
- Board game collection doesn't change frequently
- Staff control when updates go live
- Allows review before publishing changes

### Server Filesystem Dependency

Cache is stored on the server's filesystem.

**Considerations:**
- Works perfectly on VPS/dedicated hosting
- Works on Vercel/Netlify (but cache may be cleared on deploy)
- Not shared across multiple server instances
- Cache lost if server storage is cleared

**Solution for serverless hosting:**
- Consider using Redis or similar for shared cache
- Or accept cache rebuild on cold starts (still better than no cache)

### Manual Refresh Required

Users don't see updates until staff refreshes.

**Mitigations:**
- Clear "Refresh Data" button for staff
- Toast notification on successful refresh
- Display last updated timestamp
- Staff mode makes refresh obvious and easy

## Monitoring

### Cache Status

Staff can check cache status:
- **Last updated timestamp:** Shown in API response
- **Record count:** Verify expected number
- **File size:** Check `data/` directory

### Health Checks

```bash
# Check cache files exist
ls data/

# Check cache file contents
cat data/games-cache.json | head -n 20

# Check file modification time
stat data/games-cache.json
```

### Troubleshooting

**Cache not updating:**
1. Check API response from refresh endpoint
2. Verify `data/` directory is writable
3. Check server logs for errors
4. Confirm refresh button is calling correct endpoint

**Cache missing after deploy:**
1. Normal on serverless platforms
2. First user will trigger cache creation
3. Or manually trigger refresh after deploy

**Stale data showing:**
1. Verify refresh was actually called
2. Check last updated timestamp
3. Clear browser cache (client-side cache)
4. Verify API is returning cached data

## Future Enhancements

### Auto-Refresh
- Scheduled cache refresh (daily at 3 AM)
- Webhook from Airtable when data changes
- Background refresh with no user action needed

### Cache Versioning
- Multiple cache versions
- Rollback capability
- A/B testing with different datasets

### Distributed Cache
- Redis or Memcached
- Shared across server instances
- TTL-based expiration
- Pub/sub for cache invalidation

### Smart Invalidation
- Partial cache updates (single game)
- Diff-based updates (only changed records)
- Optimistic updates (update UI, sync cache later)

### Cache Analytics
- Hit/miss rate tracking
- Average response time
- Cache size monitoring
- Usage patterns analysis

## Related Documentation

- [Board Games Catalog](./board-games-catalog.md) - Uses games cache
- [Content Checker](./content-checker.md) - Uses content checks cache
- [Staff Mode](./staff-mode.md) - Refresh button visibility
