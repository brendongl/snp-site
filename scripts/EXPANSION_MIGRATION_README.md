# Board Game Expansion Migration Guide

This guide explains how to migrate expansion relationships from Airtable to PostgreSQL using the `base_game_id` column.

## Overview

**Problem**: PostgreSQL doesn't have Airtable's "linked records" feature
**Solution**: Use a `base_game_id` foreign key column to create parent-child relationships

### How It Works

```
Base Game Record:
- id: "rec123"
- name: "Catan"
- base_game_id: NULL          ← NULL means it's a base game

Expansion Record:
- id: "rec456"
- name: "Catan: Seafarers"
- base_game_id: "rec123"      ← Points to parent game
```

### Benefits
- ✅ Single source of truth (no boolean needed!)
- ✅ Standard SQL pattern (foreign key relationship)
- ✅ Easy queries: `WHERE base_game_id IS NULL` = base games only
- ✅ Automatic referential integrity with foreign key constraint

## Migration Steps

### Step 1: Add the `base_game_id` Column

This creates the column, foreign key constraint, and index.

```bash
node scripts/add-base-game-column.js
```

**What it does:**
- Adds `base_game_id VARCHAR(50)` column to `games` table
- Creates foreign key constraint: `FOREIGN KEY (base_game_id) REFERENCES games(id)`
- Creates index on `base_game_id` for faster lookups
- Safe: Checks if column exists first (won't fail if re-run)

### Step 2: Migrate Expansion Data from Airtable

This populates the `base_game_id` column with data from Airtable.

```bash
node scripts/migrate-expansions-from-airtable.js
```

**What it does:**
1. Fetches all games from Airtable
2. Identifies expansions (games with "Base Game" field populated)
3. Matches games by name between Airtable and PostgreSQL
4. Updates PostgreSQL with the correct `base_game_id` relationships
5. Provides detailed progress and summary report

**Expected output:**
```
🔍 Fetching games from Airtable...

✅ Found 450 base games
✅ Found 23 expansions

📝 Updating expansion relationships in PostgreSQL...

✅ Linked: "Catan: Seafarers" → "Catan"
✅ Linked: "Ticket to Ride: Europe" → "Ticket to Ride"
...

📊 Migration Summary:
✅ Successfully linked: 21 expansions
⚠️  Skipped: 2 expansions
❌ Errors: 0 expansions

🔍 Total expansions in PostgreSQL: 21
```

## Code Changes Made

### 1. Games Database Service (`lib/services/games-db-service.ts`)

**Added Methods:**
- `getExpansions(gameId)` - Returns all expansions for a base game
- Updated `createGame()` - Now supports `baseGameId` parameter

**Updated Methods:**
- `getAllGamesWithImages()` - Filters out expansions (`WHERE base_game_id IS NULL`)
- `searchGames()` - Only returns base games in search results
- `getGamesByCategory()` - Only returns base games in category browsing
- `getRandomGame()` - Only picks from base games
- `getGameById()` - Updated to include `base_game_id` field

### 2. Add Game Endpoint (`app/api/games/create/route.ts`)

Now supports creating expansions:
```typescript
const gameData = {
  // ... other fields
  baseGameId: 'rec123',  // Set this to create an expansion
};
```

## How to Use After Migration

### Creating a New Expansion

```typescript
// When adding a game via "Add Game" dialog:
{
  isExpansion: true,
  baseGameId: 'rec123456',  // ID of parent game
  // ... other game data
}
```

### Fetching Expansions for a Game

```typescript
const db = DatabaseService.initialize();
const expansions = await db.games.getExpansions('game_id');

// Returns array of BoardGame objects
```

### Checking if Game is Expansion

```typescript
// No boolean needed! Just check:
const game = await db.games.getGameById('game_id');
const isExpansion = game.fields['Base Game ID'] !== null;
```

## Website Behavior After Migration

### Main Games Gallery (`/games`)
- **Shows**: Only base games
- **Hidden**: All expansions
- **Filtering**: Works with `WHERE base_game_id IS NULL`

### Game Detail Modal
- **Base Game**: Will display list of expansions below game info
- **Expansion**: Will display link/info about parent game

### Add Game Dialog
- Can mark game as expansion
- Select parent game from dropdown
- Automatically sets `base_game_id` on creation

## Troubleshooting

### Migration Script Shows "Not Found"

**Problem**: Game exists in Airtable but not PostgreSQL
**Solution**: The game hasn't been synced yet. Run the main games sync first.

### Duplicate Expansions After Migration

**Problem**: Same expansion appears multiple times
**Solution**: Check for duplicate game names in PostgreSQL and clean up manually.

### Expansions Still Showing in Main Gallery

**Problem**: `base_game_id IS NULL` filter not working
**Solution**: Check that migration script ran successfully and column was populated.

## Reverting (If Needed)

To remove the column (DANGER - this deletes all expansion relationships):

```sql
ALTER TABLE games DROP COLUMN base_game_id;
```

**Note**: You can always re-run the migration scripts to restore the data from Airtable.

## Database Schema

### Before Migration
```sql
CREATE TABLE games (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  game_expansions_link VARCHAR(50)[],  -- Array, manually maintained
  ...
);
```

### After Migration
```sql
CREATE TABLE games (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  base_game_id VARCHAR(50) REFERENCES games(id),  -- Foreign key!
  game_expansions_link VARCHAR(50)[],              -- Can be kept for legacy
  ...
);

CREATE INDEX idx_base_game_id ON games(base_game_id);
```

## Support

Questions or issues? Check:
1. Migration script output for error messages
2. PostgreSQL logs for constraint violations
3. Airtable "Base Game" field is properly populated

---

**Migration created**: 2025-10-21
**PostgreSQL Version**: 14+
**Airtable API Version**: v0
