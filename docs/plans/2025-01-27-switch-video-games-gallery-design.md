# Nintendo Switch Video Games Gallery - Design Document

**Date:** January 27, 2025
**Version:** 1.0
**Status:** Approved for Implementation

## Overview

Create a public video games gallery at `/video-games` featuring Nintendo Switch games from the cafe's 6 physical consoles (Samus, Toad, Yoshi, Fox, LMac, Wolf). The architecture is designed to be future-proof for additional gaming platforms (PS5, Xbox, Wii, etc.).

## Goals

1. Display video game library similar to existing board games gallery (`/games`)
2. Allow staff to filter games by physical console location
3. Show comprehensive game metadata including age ratings for family recommendations
4. Cache game images locally for fast loading
5. Support future expansion to other gaming platforms

## Architecture Approach

**Progressive Enhancement Strategy:**
- **Phase 1:** Launch with Nintendo Switch games only (separate from board games)
- **Phase 2:** Extract shared UI components when patterns emerge
- **Phase 3:** Add cross-system search (optional)
- **Future:** Unified gaming platform if needed

## Database Schema

### Table: `video_games`

```sql
CREATE TABLE video_games (
  id TEXT PRIMARY KEY,                  -- Platform-specific ID (TitleID for Switch: "0100000000010000")
  platform TEXT NOT NULL,               -- "switch", "ps5", "xbox", "wii", etc.
  name TEXT NOT NULL,
  publisher TEXT,
  developer TEXT,
  release_date INTEGER,                 -- YYYYMMDD format (e.g., 20171027)
  description TEXT,
  category TEXT[],                      -- Genres: ["Platformer", "Action"]
  languages TEXT[],                     -- ["ja", "en", "es", "fr", "de", ...]
  number_of_players INTEGER,
  rating_content TEXT[],                -- ["Cartoon Violence", "Comic Mischief"]
  platform_specific_data JSONB,        -- Flexible field for platform-unique data
  located_on TEXT[],                    -- Physical locations: ["Samus", "Toad", ...]
  image_url TEXT,                       -- Deprecated, kept for compatibility
  image_landscape_url TEXT,             -- 16:9 landscape cover
  image_portrait_url TEXT,              -- Portrait box art
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_game_platform UNIQUE(id, platform)
);

CREATE INDEX idx_video_games_platform ON video_games(platform);
CREATE INDEX idx_video_games_located_on ON video_games USING GIN(located_on);
CREATE INDEX idx_video_games_category ON video_games USING GIN(category);
```

**Key Design Decisions:**
- Single table for all platforms (not separate tables per platform)
- `platform` field discriminates between gaming systems
- `located_on` array allows one game to be on multiple physical consoles
- `platform_specific_data` JSONB stores platform-unique metadata:
  - Switch: `{nsuid: 70010000001130, rights_id: "..."}`
  - PS5: `{product_id: "...", psn_id: "..."}`
  - Future platforms: Add fields as needed
- Both landscape and portrait image URLs for flexibility

## Data Source: Nintendo Switch

### Metadata Source: ghost-land/NX-DB
- **Repository:** https://github.com/ghost-land/NX-DB
- **Structure:** Individual JSON files per game: `/base/{TITLEID}.json`
- **Example:** `https://raw.githubusercontent.com/ghost-land/NX-DB/main/base/0100000000010000.json`

**Available Fields:**
```json
{
  "id": "0100000000010000",
  "name": "Super Mario Odyssey™",
  "publisher": "Nintendo",
  "developer": null,
  "releaseDate": 20171027,
  "description": "...",
  "category": ["Platformer", "Action"],
  "languages": ["ja", "en", "es", "fr", "de", "it", "nl", "ru", "zh"],
  "nsuId": 70010000001130,
  "numberOfPlayers": 2,
  "ratingContent": ["Cartoon Violence", "Comic Mischief"],
  "intro": "...",
  "isDemo": false,
  "region": null,
  "rightsId": "01000000000100000000000000000003",
  "latest_update": {
    "id": "0100000000010800",
    "version": "393216"
  }
}
```

### Image Source: Nintendo CDN
- **Base URL:** `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/`
- **Landscape (16:9):** `{NSUID}/hero`
- **Portrait (box art):** `{NSUID}/box-emart`
- **Fallback:** `f_auto,q_auto,w_960/ncom/en_US/games/switch/{NSUID}/hero`

**Image Storage:**
```
/app/data/video-game-images/
  switch/
    {titleId}_landscape.jpg
    {titleId}_portrait.jpg
```

## Initial Data Collection

### Source: CSV Files
Location: `switchgamelist/*.csv`
- Samus_24-10.csv
- Toad_24-10.csv
- Yoshi_24-10.csv
- Fox_24-10.csv
- LMac_24-10.csv
- Wolf_24-10.csv

**CSV Format:**
```
0x01006FE013472000,131072,"Mario Party Superstars"
0x0100152000022000,1376256,"Mario Kart 8 Deluxe"
0x0100152000023001,65536,"Mario Kart 8 Deluxe DLC 1"
```

### Filtering Logic for Initial 20 Games
1. Remove `0x` prefix from TitleIDs
2. Filter base games only (TitleID ends in `000`, exclude DLC/updates ending in other values)
3. Find games present on **all 6 switches** (maximum availability)
4. If <20 games on all switches: include games on 5+ switches, then 4+, etc.
5. Sort by recognizable titles (Mario, Zelda, Pokemon first)
6. Take first 20 games

### TitleID Format
- **Length:** 16 hexadecimal characters
- **Pattern:** `0100[0-9A-F]{3}0[0-9A-F]{5}000` (base games)
- **Example:** `0100000000010000` (Super Mario Odyssey)
- **DLC/Updates:** End with non-000 values (e.g., `...001`, `...800`)

## Service Layer

### VideoGamesDbService (`lib/services/video-games-db-service.ts`)

```typescript
class VideoGamesDbService {
  // Core CRUD
  async getAllGames(platform?: string): Promise<VideoGame[]>
  async getGameById(id: string, platform: string): Promise<VideoGame | null>
  async createGame(gameData: Partial<VideoGame>): Promise<VideoGame>
  async updateGame(id: string, platform: string, updates: Partial<VideoGame>): Promise<VideoGame>

  // Filtering
  async getGamesByPlatform(platforms: string[]): Promise<VideoGame[]>
  async getGamesByLocation(locations: string[]): Promise<VideoGame[]>  // OR logic
  async getGamesByCategory(categories: string[]): Promise<VideoGame[]>

  // Search
  async searchGames(query: string, platform?: string): Promise<VideoGame[]>

  // Platform-specific helpers
  async getSwitchGames(): Promise<VideoGame[]>  // platform = 'switch'
}
```

### VideoGameImagesService (`lib/services/video-game-images-service.ts`)

```typescript
class VideoGameImagesService {
  // Download from CDN
  async downloadFromNintendoCDN(nsuid: string, type: 'landscape' | 'portrait'): Promise<Buffer>

  // Cache management
  async cacheImage(titleId: string, platform: string, imageBuffer: Buffer, type: string): Promise<string>
  async getCachedImagePath(titleId: string, platform: string, type: string): Promise<string | null>

  // Serve images
  async serveImage(titleId: string, platform: string, type: string): Promise<Response>
}
```

## API Endpoints

### Core Endpoints
- `GET /api/video-games` - Get all games (optional `?platform=switch` filter)
- `GET /api/video-games/[id]` - Get single game by ID
- `POST /api/video-games/create` - Create new game (admin)
- `POST /api/video-games/[id]/edit` - Update game metadata (admin)

### Image Serving
- `GET /api/video-games/images/[titleId]?type=landscape&platform=switch` - Serve cached image

**Response format matches existing `/api/games` pattern:**
```json
{
  "games": [...],
  "count": 20
}
```

## UI Components

### Page Structure

**Route:** `/video-games` (public page)

**Layout:**
```
┌─────────────────────────────────────┐
│ Header: "Video Games Library"      │
│ Search bar                          │
│ ┌──────────────────────────────┐   │
│ │ ▼ Filters (collapsible)      │   │ ← Starts collapsed
│ │   Console Location:          │   │
│ │   ☐ Samus  ☐ Toad  ☐ Yoshi  │   │
│ │   ☐ Fox    ☐ LMac  ☐ Wolf   │   │
│ │   Genre: [All ▼]             │   │
│ └──────────────────────────────┘   │
│                                     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐│  Desktop: 4 columns
│ │ Game │ │ Game │ │ Game │ │Game ││
│ │ 16:9 │ │ 16:9 │ │ 16:9 │ │16:9 ││
│ └──────┘ └──────┘ └──────┘ └─────┘│
│                                     │
│ ┌────────┐ ┌────────┐             │  Mobile: 2 columns
│ │  Game  │ │  Game  │             │
│ │  16:9  │ │  16:9  │             │
│ └────────┘ └────────┘             │
└─────────────────────────────────────┘
```

**Responsive Breakpoints:**
- Desktop (1024px+): 4 columns
- Tablet (768px-1023px): 3 columns
- Mobile (<768px): 2 columns

### Component Files

1. **`app/video-games/page.tsx`** - Main gallery page
   - Grid layout with responsive columns
   - Search and filter state management
   - Fetches from `/api/video-games`

2. **`components/features/video-games/VideoGameCard.tsx`**
   - 16:9 landscape image
   - Game name overlay (bottom gradient)
   - Genre badges
   - Click → opens modal

3. **`components/features/video-games/VideoGameModal.tsx`**
   - Large landscape image
   - Game metadata: publisher, release date, genres, players
   - Rating content badges (important for kids)
   - Description text
   - Location badges showing which consoles have it
   - "View Full Details" button → `/video-games/[id]`

4. **`components/features/video-games/VideoGameFilters.tsx`**
   - Collapsible section (starts collapsed)
   - Multi-select checkboxes for console locations
   - Genre dropdown
   - Clear filters button

5. **`app/video-games/[id]/page.tsx`** - Full detail page
   - Both landscape and portrait images
   - Complete metadata display
   - Languages supported
   - Rating details expanded
   - Similar games (future feature)

## Migration Script

### Script: `scripts/migrate-switch-games.js`

**Process:**
1. Read all 6 CSV files from `switchgamelist/`
2. Parse TitleIDs (remove `0x`, filter base games ending in `000`)
3. Find games on all 6 switches for initial sample
4. For each game:
   - Fetch metadata from NX-DB: `https://raw.githubusercontent.com/ghost-land/NX-DB/main/base/{TITLEID}.json`
   - Parse and map fields to database schema
   - Download landscape + portrait images from Nintendo CDN using `nsuid`
   - Cache images to persistent volume
   - Build `located_on` array based on which CSVs contain the TitleID
   - Insert into PostgreSQL with `platform = 'switch'`

**Features:**
- Dry-run mode (`--dry-run` flag)
- Progress logging (X/20 games processed)
- Error handling with retries (3 attempts with exponential backoff)
- Error log file: `/data/logs/video-game-migration-errors.log`
- Incremental (can re-run to add more games)

**Example command:**
```bash
node scripts/migrate-switch-games.js --dry-run
node scripts/migrate-switch-games.js --limit=20
```

## Error Handling

### Migration Script
- Game not in NX-DB → Log warning, skip
- Image download fails → Use placeholder, log for manual review
- Network timeout → Retry 3x with exponential backoff
- Missing required fields → Log error, skip game
- Duplicate game → Update existing record

### Runtime (UI)
- Image fails to load → Show placeholder icon
- API timeout → Show cached data if available
- No games match filter → "No games found" message + clear filters button
- Invalid TitleID in URL → 404 page with back link

### Data Validation
- TitleID format: 16 chars, hex, pattern `0100...000`
- Release date: 1990-2030 range
- Category array not empty
- At least one image downloaded successfully

## Testing Checklist

### Before Launch
- [ ] Migration script: Dry-run with 3 test games
- [ ] Migration script: Full run with 20 games
- [ ] All images downloaded and cached
- [ ] API endpoints return correct data
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Switch filter checkboxes work (OR logic)
- [ ] Genre filter works
- [ ] Search filters name and publisher
- [ ] Modal opens/closes smoothly
- [ ] "View Full Details" navigates correctly
- [ ] Rating content displays for kid-friendly filtering
- [ ] No duplicate games in default view
- [ ] Clear filters resets to all games

### Staging Deployment
1. Create database table on staging
2. Run migration with 3 test games
3. Verify UI and functionality
4. Run full 20-game migration
5. User testing and approval
6. Push to main after confirmation

## Future Enhancements (Post-Launch)

### Phase 2: Shared Components
- Extract `GameCardBase` component
- Shared modal system
- Unified search bar

### Phase 3: Additional Platforms
- PS5 games (similar process with different data source)
- Xbox games
- Retro consoles (Wii, GameCube, etc.)
- Platform tabs in UI

### Phase 4: Advanced Features
- Similar games recommendations
- Play history tracking (like board game play logs)
- Staff favorites
- Cross-platform search

## Success Criteria

✅ **Minimum Viable Product:**
1. 20 Switch games visible in gallery
2. 16:9 landscape images displayed
3. Responsive grid (4/3/2 columns)
4. Console location filter works
5. Genre filter works
6. Modal and detail page show complete info
7. Rating content visible for family filtering
8. Images load from persistent volume cache
9. No duplicates in default view

✅ **Future-Proof:**
1. Database schema supports multiple platforms
2. Code structure allows easy addition of PS5/Xbox
3. Service layer abstracted for platform flexibility

## Technical Stack

- **Database:** PostgreSQL (existing Railway instance)
- **Image Storage:** Persistent volume (`/app/data/video-game-images/`)
- **Frontend:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS (existing patterns)
- **Data Source:** ghost-land/NX-DB (GitHub), Nintendo CDN
- **Deployment:** Railway (Docker), staging → main workflow

## Version History

- **v1.0** (2025-01-27): Initial design approved
