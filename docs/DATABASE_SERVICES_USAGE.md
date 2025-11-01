# Database Services Usage Guide

Quick reference for using PostgreSQL database services in API endpoints and components.

## ⚠️ CRITICAL: Staff ID Reference

**There are TWO different ID fields for staff members. Using the wrong one will cause bugs:**

| Field Name | Source Table | Used For | localStorage Key | Description |
|------------|--------------|----------|------------------|-------------|
| `staff_id` | `staff_list` | Display only | `staff_id` | PostgreSQL primary key (internal use) |
| `stafflist_id` | `staff_list` | **All database operations** | `staff_record_id` | Foreign key for content_checks, staff_knowledge, play_logs |

**Key Rule**: When creating/updating records, **ALWAYS use `stafflist_id` (stored as `staff_record_id` in localStorage)**.

**Example**:
```typescript
// ❌ WRONG - This will cause inspector/staff matching issues
const inspectorId = localStorage.getItem('staff_id'); // WRONG!

// ✅ CORRECT - Use stafflist_id for all database operations
const inspectorId = localStorage.getItem('staff_record_id'); // CORRECT!
```

**Why This Matters**: The `staff_list` table caches data from TWO Airtable bases, each with different record IDs. The `stafflist_id` is used across all relational tables.

## Initialization

### In API Routes
```typescript
import DatabaseService from '@/lib/services/db-service';

// Initialize on app startup (in middleware or root route)
DatabaseService.initialize();

// Get singleton instance
const db = DatabaseService.getInstance();
```

### Health Check
```typescript
const health = await db.healthCheck();
// Returns: { status: 'ok' | 'error', message: string }
```

## Games Service

### Get All Games
```typescript
const games = await db.games.getAllGames();
// Returns: BoardGame[]
```

### Get Single Game
```typescript
const game = await db.games.getGameById('recABC123');
// Returns: BoardGame | null
```

### Search Games
```typescript
const results = await db.games.searchGames('Catan');
// Full-text search in name and description
// Returns: BoardGame[]
```

### Get Games by Category
```typescript
const strategy = await db.games.getGamesByCategory('Strategy');
// Returns: BoardGame[]
```

### Get Random Game
```typescript
const random = await db.games.getRandomGame();
// Perfect for "Pick a Random Game" feature
// Returns: BoardGame | null
```

### Get Game Images
```typescript
const images = await db.games.getGameImages('recABC123');
// Returns: Array<{ id, url, fileName, hash }>
// Use urls directly for caching
```

### Update Game Metadata
```typescript
await db.games.updateGame('recABC123', {
  name: 'New Name',
  complexity: 4,
  sleeved: true,
  latest_check_date: new Date().toISOString(),
});
```

## Content Checks Service

### Get All Checks
```typescript
const checks = await db.contentChecks.getAllChecks();
// Returns: ContentCheck[]
```

### Get Checks for Game
```typescript
const gameChecks = await db.contentChecks.getChecksByGameId('recABC123');
// Returns: ContentCheck[]
```

### Get Checks by Inspector
```typescript
// Note: Use stafflist_id (NOT staff_id) for inspector lookups
const stafflistId = localStorage.getItem('staff_record_id');
const staffChecks = await db.contentChecks.getChecksByInspector(stafflistId);
// Returns: ContentCheck[]
```

### Get Latest Check for Game
```typescript
const latest = await db.contentChecks.getLatestCheckForGame('recABC123');
// Returns: ContentCheck | null
// Use for "Latest Check" badge on game cards
```

### Create Content Check
```typescript
// IMPORTANT: inspectorId must be stafflist_id (from staff_record_id in localStorage)
const check = await db.contentChecks.createCheck({
  gameId: 'recABC123',
  inspectorId: localStorage.getItem('staff_record_id'), // Use stafflist_id!
  checkDate: new Date().toISOString(),
  status: ['Complete', 'Good Condition'],
  missingPieces: false,
  boxCondition: 'Good',
  cardCondition: 'Good',
  isFake: false,
  notes: 'All pieces present and accounted for',
  sleeved: true,
  boxWrapped: false,
  photos: ['https://example.com/photo1.jpg'],
});
```

### Update Check
```typescript
const updated = await db.contentChecks.updateCheck('recCheck123', {
  status: ['Complete', 'Excellent'],
  notes: 'Updated notes',
});
```

### Delete Check
```typescript
await db.contentChecks.deleteCheck('recCheck123');
```

### Get Checks by Date Range
```typescript
const monthChecks = await db.contentChecks.getChecksByDateRange(
  '2025-10-01',
  '2025-10-31'
);
// Returns: ContentCheck[]
```

## Staff Knowledge Service

### Get Knowledge for Staff Member
```typescript
const staffGames = await db.staffKnowledge.getKnowledgeByStaffMember('recStaff123');
// Returns: StaffKnowledge[]
// Shows which games this staff member knows
```

### Get Knowledge for Game
```typescript
const teachers = await db.staffKnowledge.getKnowledgeByGame('recGame123');
// Returns: StaffKnowledge[]
// Shows which staff members know this game
```

### Get Specific Knowledge
```typescript
const knowledge = await db.staffKnowledge.getKnowledge('recStaff123', 'recGame123');
// Returns: StaffKnowledge | null
// Get specific staff-game combination
```

### Create/Update Knowledge
```typescript
const knowledge = await db.staffKnowledge.createKnowledge({
  staffMemberId: 'recStaff123',
  gameId: 'recGame123',
  confidenceLevel: 85, // 0-100
  canTeach: true,
  notes: 'Expert player, has taught many times',
});
// Upserts on conflict (updates if exists)
```

### Update Knowledge
```typescript
const updated = await db.staffKnowledge.updateKnowledge('recKnowledge123', {
  confidenceLevel: 95,
  canTeach: true,
});
```

### Get Teachers for Game
```typescript
const teachers = await db.staffKnowledge.getTeachersForGame('recGame123');
// Returns: StaffKnowledge[] (filtered to can_teach = true)
// Use for "Who can teach this?" feature
```

### Get Teachable Games by Staff
```typescript
const teachable = await db.staffKnowledge.getTeachableGamesByStaff('recStaff123');
// Returns: StaffKnowledge[] (filtered to can_teach = true)
// Use for staff profile "I can teach" list
```

## Play Logs Service

### Get All Play Logs
```typescript
const logs = await db.playLogs.getAllLogs();
// Returns: PlayLog[]
```

### Get Logs for Game
```typescript
const gameLogs = await db.playLogs.getLogsByGameId('recGame123');
// Returns: PlayLog[]
// Shows play history for a game
```

### Get Logs by Staff Member
```typescript
const staffLogs = await db.playLogs.getLogsByStaffMember('recStaffList123');
// Returns: PlayLog[]
// Shows play history for staff member
```

### Get Single Log
```typescript
const log = await db.playLogs.getLogById('recLog123');
// Returns: PlayLog | null
```

### Create Play Log (Most Important)
```typescript
const log = await db.playLogs.createLog({
  gameId: 'recGame123',
  staffListId: localStorage.getItem('staff_record_id'), // MUST use stafflist_id (staff_record_id in localStorage)
  sessionDate: new Date().toISOString(),
  notes: 'Fun game session with 4 players',
  durationHours: 2.5,
});
// This is the main operation - replaces Airtable Play Logs
```

### Update Play Log
```typescript
const updated = await db.playLogs.updateLog('recLog123', {
  notes: 'Updated notes',
  durationHours: 3,
});
```

### Delete Play Log
```typescript
await db.playLogs.deleteLog('recLog123');
```

### Get Logs by Date Range
```typescript
const monthLogs = await db.playLogs.getLogsByDateRange(
  '2025-10-01',
  '2025-10-31'
);
// Returns: PlayLog[]
```

### Get Total Play Time for Game
```typescript
const totalHours = await db.playLogs.getTotalPlayTimeForGame('recGame123');
// Returns: number
// Use for game statistics
```

### Get Total Play Time for Staff
```typescript
const totalHours = await db.playLogs.getTotalPlayTimeForStaff('recStaffList123');
// Returns: number
// Use for staff statistics
```

## Example API Endpoint

### GET /api/games/search
```typescript
import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export async function GET(request: NextRequest) {
  try {
    // Initialize database
    const db = DatabaseService.getInstance();

    // Get query parameter
    const searchTerm = request.nextUrl.searchParams.get('q') || '';

    // Search games
    const games = await db.games.searchGames(searchTerm);

    // Get image count for each game
    const gamesWithImages = await Promise.all(
      games.map(async (game) => {
        const images = await db.games.getGameImages(game.id);
        return {
          ...game,
          imageCount: images.length,
        };
      })
    );

    return NextResponse.json(gamesWithImages);
  } catch (error) {
    console.error('Error searching games:', error);
    return NextResponse.json({ error: 'Failed to search games' }, { status: 500 });
  }
}
```

### POST /api/content-checks
```typescript
import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    const body = await request.json();

    // Create content check
    const check = await db.contentChecks.createCheck({
      gameId: body.gameId,
      inspectorId: body.inspectorId, // This should be stafflist_id from client
      checkDate: new Date().toISOString(),
      status: body.status || [],
      missingPieces: body.missingPieces || false,
      boxCondition: body.boxCondition,
      cardCondition: body.cardCondition,
      isFake: body.isFake || false,
      notes: body.notes,
      sleeved: body.sleeved || false,
      boxWrapped: body.boxWrapped || false,
      photos: body.photos || [],
    });

    return NextResponse.json(check, { status: 201 });
  } catch (error) {
    console.error('Error creating content check:', error);
    return NextResponse.json(
      { error: 'Failed to create content check' },
      { status: 500 }
    );
  }
}
```

### POST /api/play-logs (NEW)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { getSession } from '@/lib/auth'; // Your auth function

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = DatabaseService.getInstance();
    const body = await request.json();

    // Get staff member's StaffList ID
    // (Must use StaffList ID from SNP Games List base, not Staff ID!)
    const staffListId = session.staffListId; // This is stafflist_id from auth

    // Create play log
    const log = await db.playLogs.createLog({
      gameId: body.gameId,
      staffListId: staffListId,
      sessionDate: body.sessionDate || new Date().toISOString(),
      notes: body.notes,
      durationHours: body.durationHours,
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Error creating play log:', error);
    return NextResponse.json(
      { error: 'Failed to create play log' },
      { status: 500 }
    );
  }
}
```

## Error Handling

All service methods throw errors on failure. Always wrap in try-catch:

```typescript
try {
  const game = await db.games.getGameById(gameId);
  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }
  return NextResponse.json(game);
} catch (error) {
  console.error('Database error:', error);
  return NextResponse.json(
    { error: 'Database error' },
    { status: 500 }
  );
}
```

## Performance Notes

- **PostgreSQL**: Local queries are instant (<10ms typically)
- **No Rate Limiting**: Unlike Airtable, unlimited queries
- **Connection Pooling**: Services use connection pools for efficiency
- **Indexes**: All search/filter queries use database indexes
- **Transactions**: All operations are atomic

## Migration from Airtable

When updating existing endpoints:

**Before (Airtable):**
```typescript
const games = await gamesService.getAllGames(); // Airtable API call
```

**After (PostgreSQL):**
```typescript
const db = DatabaseService.getInstance();
const games = await db.games.getAllGames(); // PostgreSQL query
```

That's it! Everything else remains the same from the API consumer's perspective.
