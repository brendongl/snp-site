# Content Checker System

The Content Checker system tracks the physical condition of board games, including missing pieces, box/card condition, and protective measures like sleeving and wrapping.

## Overview

Staff can record content checks to:
- Track game condition over time
- Identify missing pieces
- Monitor box and card wear
- Record protective measures (sleeving, wrapping)
- Flag counterfeit copies

## Table Structure

### Content Check Log Table (`tblHWhNrHc9r3u42Q`)

| Field | Type | Description |
|-------|------|-------------|
| Record ID | Text | Unique identifier (auto-generated for migrated records) |
| Board Game | Link to BG List | The game being checked (allows multiple) |
| Check Date | Date | When the check was performed |
| Inspector | Link to Staff | Who performed the check |
| Status | Single Select | Overall condition (see Status Categories) |
| Missing Pieces | Long Text | Description of any missing components |
| Box Condition | Single Select | Box physical condition |
| Card Condition | Single Select | Card physical condition |
| Is Fake | Checkbox | Flag for counterfeit detection |
| Notes | Long Text | Additional observations |
| Sleeved At Check | Checkbox | Whether cards were sleeved |
| Box Wrapped At Check | Checkbox | Whether box was wrapped |
| Photos | Attachments | Photos documenting condition |

### BG List Table (Board Games) - Added Fields

| Field | Type | Description |
|-------|------|-------------|
| All Content Checks | Link | Links to Content Check Log (multiple) |
| Latest Check Date | Rollup (MAX) | Most recent check date |
| Latest Check Status | Lookup | Status from latest check |
| Latest Check Notes | Lookup | Notes from latest check |
| Total Checks | Count | Number of checks performed |
| Sleeved | Checkbox | Current sleeved status |
| Box Wrapped | Checkbox | Current wrapped status |

## Status Categories

### Perfect Condition
- All components present
- No damage to box or cards
- Game is fully playable
- No issues noted

**Keywords that indicate Perfect:** "OK", "all good", "complete", "no issues"

### Minor Issues
- Very minor damage (light wear, small dents)
- 1-2 non-critical pieces missing
- Cosmetic issues that don't affect gameplay
- Still fully playable

**Keywords that trigger Minor:** "missing", "damaged", "torn", "worn", "bent", "stained"

### Major Issues
- Significant damage
- Multiple missing pieces
- Affects gameplay but still technically playable
- May have counterfeit components

**Keywords that trigger Major:** "many missing", "multiple missing", "severely damaged", "fake", "counterfeit"

### Unplayable
- Critical components missing
- Severe damage making game unusable
- Confirmed counterfeit
- Cannot be played in current state

**Keywords that trigger Unplayable:** "unplayable", "destroyed"

## Migration Process

Data was migrated from the old `ContentsChecker` table to the new `Content Check Log` table.

### Migration Strategy

1. **Fetch all old records** from ContentsChecker
2. **Analyze notes** to determine status category
3. **Extract missing pieces** from notes text
4. **Identify unique games** and their check history
5. **Migrate selectively:**
   - ✅ Latest "OK" report per game (most recent only)
   - ✅ ALL records with issues (every single one)
   - ⏭️ Skip older duplicate "OK" reports
6. **Create new records** in Content Check Log
7. **Preserve old table** for reference

### Migration Results

- **276** total records in old table
- **140** unique board games
- **226** records migrated:
  - 146 issue reports (all preserved)
  - 80 latest OK reports (one per game)
- **42** older OK reports skipped (duplicates)
- **0** errors

### Photos Note

Photos were **not migrated** due to Airtable API limitations. The attachment object format from read operations cannot be used in create operations. Photos remain in the old ContentsChecker table for reference.

## Staff Mode Access

Content check information is only visible to staff members using the `?staff=true` URL parameter.

### What Staff Can See

1. **In GameDetailModal:**
   - Content Status section (bordered area at bottom)
   - Status badges (Perfect/Minor Issues/Major Issues/Unplayable)
   - Sleeved and Box Wrapped badges
   - Last checked date
   - Total checks count
   - Latest notes preview
   - "View History" button

2. **In ContentCheckHistory modal:**
   - Complete timeline of all checks
   - Full details for each check:
     - Date and inspector
     - Status with color-coded indicator
     - Box and card condition ratings
     - Missing pieces details
     - Sleeved/wrapped status at check time
     - Counterfeit flag
     - Full notes
     - Photo attachment indicators

### How to Enable Staff Mode

Add `?staff=true` to any URL:
```
https://yourdomain.com/games?staff=true
```

The `useStaffMode()` hook checks for this parameter and returns `true` when present.

## UI Components

### ContentCheckBadge

Displays status badges with color-coding and icons:

- **Perfect Condition**: Green with shield icon
- **Minor Issues**: Yellow with warning icon
- **Major Issues**: Orange with warning icon
- **Unplayable**: Red with X icon
- **Sleeved**: Blue with package icon
- **Box Wrapped**: Purple with package icon

**Usage:**
```tsx
<ContentCheckBadge
  status={game.fields['Latest Check Status']}
  sleeved={game.fields.Sleeved}
  boxWrapped={game.fields['Box Wrapped']}
/>
```

### ContentCheckHistory

Sheet component showing complete check timeline:

**Features:**
- Sorted by date (most recent first)
- Latest check highlighted with "Latest" badge
- Color-coded cards based on status
- Expandable details for each check
- Photos indicator (count)
- Inspector names (when auth is implemented)

**Usage:**
```tsx
const [showHistory, setShowHistory] = useState(false);

<ContentCheckHistory
  open={showHistory}
  onClose={() => setShowHistory(false)}
  gameId={game.id}
  gameName={game.fields['Game Name']}
/>
```

## API Endpoints

### Get All Content Checks

```
GET /api/content-checks
```

Returns all content checks from cache (or fetches from Airtable on cache miss).

**Response:**
```json
{
  "checks": [...],
  "count": 226
}
```

### Get Checks for Specific Game

```
GET /api/content-checks?gameId={airtableRecordId}
```

Returns all checks for a specific board game, sorted by date (newest first).

### Refresh Content Checks Cache

```
POST /api/content-checks/refresh
```

Fetches latest data from Airtable and updates the cache.

**Response:**
```json
{
  "success": true,
  "count": 226,
  "previousUpdate": "2025-01-16T10:00:00.000Z",
  "currentUpdate": "2025-01-16T10:30:00.000Z"
}
```

## Service Functions

Located in `lib/airtable/content-checker-service.ts`:

### getAllChecks()
Fetches all content checks from Airtable, sorted by check date (descending).

### getChecksForGame(gameId: string)
Fetches all checks for a specific game, sorted by check date (descending).

### getLatestCheckForGame(gameId: string)
Gets only the most recent check for a game (returns first result from getChecksForGame).

## Cache System

Content checks are cached separately from games in `data/content-checks-cache.json`.

**Cache functions** (in `lib/cache/games-cache.ts`):
- `getCachedContentChecks()` - Read from cache
- `setCachedContentChecks(checks)` - Write to cache
- `getContentChecksCacheMetadata()` - Get cache timestamp and count

## Future Enhancements

### Phase 1: Authentication
- Replace `?staff=true` with proper authentication
- User roles (staff, admin, viewer)
- Session management
- Secure API endpoints

### Phase 2: Content Check Entry
- Form for staff to submit new checks
- Mobile-friendly interface
- Photo upload capability
- Barcode scanning for game selection
- Pre-fill previous status

### Phase 3: Reporting
- Games needing checks (haven't been checked in X days)
- Games with issues (filterable by severity)
- Missing pieces report
- Check frequency analytics
- Inspector performance metrics

### Phase 4: Maintenance Tracking
- Repair logs
- Replacement part orders
- Sleeving/wrapping logs
- Game retirement tracking

## Troubleshooting

### Content checks not showing
1. Verify you're using `?staff=true` in the URL
2. Check that Airtable fields were manually added (see `scripts/AIRTABLE_MANUAL_SETUP.md`)
3. Refresh the content checks cache with the API endpoint
4. Check browser console for errors

### History modal empty
1. Verify the game has linked content checks in Airtable
2. Check the "All Content Checks" field is populated
3. Ensure the link field was created correctly (allows multiple links)

### Status not updating
Content check status is from a Lookup field that pulls from the linked Content Check Log. If you add a new check:
1. The link should auto-populate in "All Content Checks"
2. Rollup/Lookup fields update automatically
3. Cache needs refresh to see changes on website
