# Staff Pages Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance staff pages (Check History, Play Logs, Staff Knowledge) with dashboard overview, statistics, missing pieces inventory, and learning opportunities tool.

**Architecture:** Add new Staff Dashboard page as mission control, enhance existing pages with filters/stats/tools, create 7 new API endpoints, add `check_type` field to content_checks table, build 5 new React components.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, PostgreSQL, Tailwind CSS, shadcn/ui

---

## Prerequisites

Before starting, ensure:
- PostgreSQL database is accessible via `DATABASE_URL`
- Existing services: `play-logs-db-service.ts`, `content-checks-db-service.ts`, `staff-knowledge-db-service.ts`
- shadcn/ui components available: `Card`, `Button`, `Select`, `Tabs`, `Checkbox`, `Dialog`

---

## Task 1: Add check_type Field to Database

**Files:**
- Create: `scripts/add-check-type-column.js`
- Modify: `lib/services/content-checks-db-service.ts:3-19` (add checkType field)
- Modify: `types/index.ts:59-87` (add check_type to ContentCheck interface)

### Step 1: Create migration script

Create `scripts/add-check-type-column.js`:

```javascript
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function addCheckTypeColumn() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Adding check_type column to content_checks table...');

    // Add column with default value
    await pool.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS check_type VARCHAR(50) DEFAULT 'regular';
    `);

    // Update existing records to have 'regular' type
    await pool.query(`
      UPDATE content_checks
      SET check_type = 'regular'
      WHERE check_type IS NULL;
    `);

    console.log('✅ check_type column added successfully');
    console.log('✅ Existing records updated to "regular" type');
  } catch (error) {
    console.error('❌ Error adding check_type column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addCheckTypeColumn();
```

### Step 2: Run migration

Run: `node scripts/add-check-type-column.js`

Expected output:
```
Adding check_type column to content_checks table...
✅ check_type column added successfully
✅ Existing records updated to "regular" type
```

### Step 3: Update ContentCheck interface in types

In `types/index.ts`, update ContentCheck interface around line 59:

```typescript
export interface ContentCheck {
  id: string;
  gameId: string;
  inspectorId: string;
  checkDate: string | null;
  checkType?: 'regular' | 'piece_recovery'; // ADD THIS LINE
  status: string[];
  missingPieces: string | null;
  boxCondition: string | null;
  cardCondition: string | null;
  isFake: boolean;
  notes: string | null;
  sleeved: boolean;
  boxWrapped: boolean;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Step 4: Update ContentChecksDbService interface

In `lib/services/content-checks-db-service.ts`, update interface around line 3:

```typescript
export interface ContentCheck {
  id: string;
  gameId: string;
  inspectorId: string;
  checkDate: string | null;
  checkType?: string; // ADD THIS LINE
  status: string[];
  missingPieces: string | null;
  boxCondition: string | null;
  cardCondition: string | null;
  isFake: boolean;
  notes: string | null;
  sleeved: boolean;
  boxWrapped: boolean;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Step 5: Update mapRowToCheck method

In `lib/services/content-checks-db-service.ts`, find `mapRowToCheck` method and add checkType field:

```typescript
private mapRowToCheck(row: any): ContentCheck {
  return {
    id: row.id,
    gameId: row.game_id,
    inspectorId: row.inspector_id,
    checkDate: row.check_date,
    checkType: row.check_type || 'regular', // ADD THIS LINE
    status: Array.isArray(row.status) ? row.status : [],
    missingPieces: row.missing_pieces,
    boxCondition: row.box_condition,
    cardCondition: row.card_condition,
    isFake: row.is_fake || false,
    notes: row.notes,
    sleeved: row.sleeved_at_check || false,
    boxWrapped: row.box_wrapped_at_check || false,
    photos: Array.isArray(row.photos) ? row.photos : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

### Step 6: Update getAllChecks query

In `lib/services/content-checks-db-service.ts`, update `getAllChecks` method to include check_type:

```typescript
async getAllChecks(): Promise<ContentCheck[]> {
  try {
    const result = await this.pool.query(`
      SELECT
        id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
        box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
        photos, created_at, updated_at
      FROM content_checks
      ORDER BY check_date DESC
    `);

    return result.rows.map(this.mapRowToCheck);
  } catch (error) {
    console.error('Error fetching all content checks from PostgreSQL:', error);
    throw error;
  }
}
```

### Step 7: Update other query methods

Update `getChecksByGameId`, `getChecksByInspector`, and `getLatestCheckForGame` methods to include `check_type` in SELECT statements (add after `check_date`).

### Step 8: Update createCheck method

In `lib/services/content-checks-db-service.ts`, update `createCheck` method to handle checkType:

```typescript
async createCheck(check: Omit<ContentCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentCheck> {
  try {
    const id = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    const result = await this.pool.query(
      `INSERT INTO content_checks (
        id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
        box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
        photos, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
        box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
        photos, created_at, updated_at`,
      [
        id,
        check.gameId,
        check.inspectorId,
        check.checkDate,
        check.checkType || 'regular', // ADD THIS
        check.status,
        check.missingPieces,
        check.boxCondition,
        check.cardCondition,
        check.isFake,
        check.notes,
        check.sleeved,
        check.boxWrapped,
        check.photos,
      ]
    );

    return this.mapRowToCheck(result.rows[0]);
  } catch (error) {
    console.error('Error creating content check in PostgreSQL:', error);
    throw error;
  }
}
```

### Step 9: Commit database changes

```bash
git add scripts/add-check-type-column.js lib/services/content-checks-db-service.ts types/index.ts
git commit -m "feat: add check_type field to content_checks table

- Add migration script for check_type column
- Update ContentCheck interface with checkType field
- Update service queries to include check_type
- Default existing records to 'regular' type

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: API Endpoint - Play Logs Statistics

**Files:**
- Create: `app/api/play-logs/stats/route.ts`

### Step 1: Create stats API endpoint

Create `app/api/play-logs/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import PlayLogsDbService from '@/lib/services/play-logs-db-service';

const playLogsService = new PlayLogsDbService(process.env.DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timePeriod = parseInt(searchParams.get('timePeriod') || '7');

    // Validate time period
    if (![7, 30, 90].includes(timePeriod)) {
      return NextResponse.json(
        { error: 'Invalid time period. Must be 7, 30, or 90.' },
        { status: 400 }
      );
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - timePeriod);
    const thresholdString = dateThreshold.toISOString().split('T')[0];

    // Get all logs with names in time period
    const allLogs = await playLogsService.getAllLogsWithNames();
    const filteredLogs = allLogs.filter(
      (log) => log.sessionDate && log.sessionDate >= thresholdString
    );

    // Calculate statistics
    const uniqueGames = new Set(filteredLogs.map((log) => log.gameId)).size;
    const totalPlays = filteredLogs.length;

    // Most played game
    const gameCounts: Record<string, { name: string; count: number }> = {};
    filteredLogs.forEach((log) => {
      if (!gameCounts[log.gameId]) {
        gameCounts[log.gameId] = { name: log.gameName, count: 0 };
      }
      gameCounts[log.gameId].count++;
    });
    const mostPlayedEntry = Object.entries(gameCounts).sort(
      ([, a], [, b]) => b.count - a.count
    )[0];
    const mostPlayed = mostPlayedEntry
      ? { game_name: mostPlayedEntry[1].name, count: mostPlayedEntry[1].count }
      : null;

    // Top logger
    const loggerCounts: Record<string, { name: string; count: number }> = {};
    filteredLogs.forEach((log) => {
      if (!loggerCounts[log.staffListId]) {
        loggerCounts[log.staffListId] = { name: log.staffName, count: 0 };
      }
      loggerCounts[log.staffListId].count++;
    });
    const topLoggerEntry = Object.entries(loggerCounts).sort(
      ([, a], [, b]) => b.count - a.count
    )[0];
    const topLogger = topLoggerEntry
      ? { staff_name: topLoggerEntry[1].name, count: topLoggerEntry[1].count }
      : null;

    return NextResponse.json({
      uniqueGames,
      totalPlays,
      mostPlayed,
      topLogger,
      timePeriod,
    });
  } catch (error) {
    console.error('Error fetching play log statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch play log statistics' },
      { status: 500 }
    );
  }
}
```

### Step 2: Test the endpoint

Run: `npm run dev`

Test: `curl "http://localhost:3000/api/play-logs/stats?timePeriod=7"`

Expected response:
```json
{
  "uniqueGames": 24,
  "totalPlays": 156,
  "mostPlayed": { "game_name": "Catan", "count": 12 },
  "topLogger": { "staff_name": "Sarah", "count": 23 },
  "timePeriod": 7
}
```

### Step 3: Commit stats endpoint

```bash
git add app/api/play-logs/stats/route.ts
git commit -m "feat: add play logs statistics API endpoint

- GET /api/play-logs/stats with timePeriod param (7/30/90 days)
- Calculate unique games, total plays, most played, top logger
- Filter logs by date threshold

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: API Endpoint - Content Checks Needs Checking

**Files:**
- Create: `app/api/content-checks/needs-checking/route.ts`

### Step 1: Create needs-checking API endpoint

Create `app/api/content-checks/needs-checking/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const daysThreshold = parseInt(searchParams.get('daysThreshold') || '30');

    // Calculate date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
    const thresholdString = thresholdDate.toISOString();

    // Query games needing checks
    const result = await pool.query(
      `
      WITH latest_checks AS (
        SELECT
          game_id,
          MAX(check_date) as last_checked_date
        FROM content_checks
        GROUP BY game_id
      ),
      plays_since_check AS (
        SELECT
          pl.game_id,
          COUNT(*) as plays_count
        FROM play_logs pl
        LEFT JOIN latest_checks lc ON pl.game_id = lc.game_id
        WHERE pl.session_date > COALESCE(lc.last_checked_date, '1970-01-01'::timestamp)
        GROUP BY pl.game_id
      )
      SELECT
        g.id as game_id,
        g.name as game_name,
        lc.last_checked_date,
        COALESCE(psc.plays_count, 0) as plays_since_check,
        CASE
          WHEN lc.last_checked_date IS NULL THEN 999999
          ELSE EXTRACT(EPOCH FROM (NOW() - lc.last_checked_date)) / 86400
        END as days_since_check
      FROM games g
      LEFT JOIN latest_checks lc ON g.id = lc.game_id
      LEFT JOIN plays_since_check psc ON g.id = psc.game_id
      WHERE
        lc.last_checked_date IS NULL
        OR lc.last_checked_date < $1
      ORDER BY days_since_check DESC
      `,
      [thresholdString]
    );

    const gamesNeedingCheck = result.rows.map((row) => ({
      game_id: row.game_id,
      name: row.game_name,
      last_checked_date: row.last_checked_date,
      plays_since_check: parseInt(row.plays_since_check),
      days_since_check: row.last_checked_date
        ? Math.floor(parseFloat(row.days_since_check))
        : null,
    }));

    return NextResponse.json({
      games: gamesNeedingCheck,
      count: gamesNeedingCheck.length,
      daysThreshold,
    });
  } catch (error) {
    console.error('Error fetching games needing checks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games needing checks' },
      { status: 500 }
    );
  }
}
```

### Step 2: Test the endpoint

Test: `curl "http://localhost:3000/api/content-checks/needs-checking?daysThreshold=30"`

Expected response:
```json
{
  "games": [
    {
      "game_id": "rec123",
      "name": "Catan",
      "last_checked_date": "2024-09-15T00:00:00.000Z",
      "plays_since_check": 12,
      "days_since_check": 45
    }
  ],
  "count": 15,
  "daysThreshold": 30
}
```

### Step 3: Commit needs-checking endpoint

```bash
git add app/api/content-checks/needs-checking/route.ts
git commit -m "feat: add content checks needs-checking API endpoint

- GET /api/content-checks/needs-checking with daysThreshold param
- Query games with last check older than threshold
- Calculate plays since last check and days since check
- Order by days since check (descending)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: API Endpoint - Missing Pieces Inventory

**Files:**
- Create: `app/api/content-checks/missing-pieces/route.ts`

### Step 1: Create missing-pieces API endpoint

Create `app/api/content-checks/missing-pieces/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

interface MissingPieceEntry {
  piece_description: string;
  game_id: string;
  game_name: string;
  check_id: string;
  reported_by: string;
  reported_date: string;
  notes: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Get all content checks with missing pieces
    const result = await pool.query(
      `
      SELECT
        cc.id as check_id,
        cc.game_id,
        cc.missing_pieces,
        cc.notes,
        cc.check_date,
        cc.inspector_id,
        g.name as game_name,
        sl.staff_name as inspector_name
      FROM content_checks cc
      JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      WHERE cc.missing_pieces IS NOT NULL
        AND cc.missing_pieces != ''
        AND cc.check_type != 'piece_recovery'
      ORDER BY cc.check_date DESC
      `
    );

    // Flatten missing pieces into individual entries
    const missingPieces: MissingPieceEntry[] = [];

    result.rows.forEach((row) => {
      // Parse missing pieces (assuming comma-separated or newline-separated)
      const pieces = row.missing_pieces
        .split(/[,\n]/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      pieces.forEach((piece: string) => {
        missingPieces.push({
          piece_description: piece,
          game_id: row.game_id,
          game_name: row.game_name,
          check_id: row.check_id,
          reported_by: row.inspector_name || 'Unknown',
          reported_date: row.check_date,
          notes: row.notes,
        });
      });
    });

    // Sort alphabetically by piece description
    missingPieces.sort((a, b) =>
      a.piece_description.localeCompare(b.piece_description)
    );

    return NextResponse.json({
      pieces: missingPieces,
      total_pieces: missingPieces.length,
      affected_games: new Set(missingPieces.map((p) => p.game_id)).size,
    });
  } catch (error) {
    console.error('Error fetching missing pieces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing pieces' },
      { status: 500 }
    );
  }
}
```

### Step 2: Test the endpoint

Test: `curl "http://localhost:3000/api/content-checks/missing-pieces"`

Expected response:
```json
{
  "pieces": [
    {
      "piece_description": "2 red trains",
      "game_id": "rec456",
      "game_name": "Ticket to Ride",
      "check_id": "chk789",
      "reported_by": "Sarah",
      "reported_date": "2024-10-15T00:00:00.000Z",
      "notes": "Missing from box after busy day"
    }
  ],
  "total_pieces": 27,
  "affected_games": 5
}
```

### Step 3: Commit missing-pieces endpoint

```bash
git add app/api/content-checks/missing-pieces/route.ts
git commit -m "feat: add missing pieces inventory API endpoint

- GET /api/content-checks/missing-pieces
- Flatten missing pieces from all checks into scannable list
- Exclude piece_recovery checks to avoid showing found pieces
- Sort alphabetically and include game context

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: API Endpoint - Mark Piece Found

**Files:**
- Create: `app/api/content-checks/mark-piece-found/route.ts`

### Step 1: Create mark-piece-found API endpoint

Create `app/api/content-checks/mark-piece-found/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import ContentChecksDbService from '@/lib/services/content-checks-db-service';
import { Pool } from 'pg';

const contentChecksService = new ContentChecksDbService(process.env.DATABASE_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { check_id, pieces_found, notes, inspector_id } = body;

    if (!check_id || !pieces_found || !Array.isArray(pieces_found)) {
      return NextResponse.json(
        { error: 'check_id and pieces_found array are required' },
        { status: 400 }
      );
    }

    if (!inspector_id) {
      return NextResponse.json(
        { error: 'inspector_id is required' },
        { status: 400 }
      );
    }

    // Get the original check to find game_id
    const originalCheckResult = await pool.query(
      'SELECT game_id, missing_pieces FROM content_checks WHERE id = $1',
      [check_id]
    );

    if (originalCheckResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Original check not found' },
        { status: 404 }
      );
    }

    const gameId = originalCheckResult.rows[0].game_id;
    const recoveryNotes = `Pieces recovered: ${pieces_found.join(', ')}${notes ? `\n\n${notes}` : ''}`;

    // Create new piece_recovery check
    const newCheck = await contentChecksService.createCheck({
      gameId,
      inspectorId: inspector_id,
      checkDate: new Date().toISOString(),
      checkType: 'piece_recovery',
      status: ['Perfect Condition'],
      missingPieces: null, // Pieces are now found
      boxCondition: null,
      cardCondition: null,
      isFake: false,
      notes: recoveryNotes,
      sleeved: false,
      boxWrapped: false,
      photos: [],
    });

    return NextResponse.json({
      success: true,
      new_check_id: newCheck.id,
      message: 'Piece recovery recorded successfully',
    });
  } catch (error) {
    console.error('Error marking piece as found:', error);
    return NextResponse.json(
      { error: 'Failed to mark piece as found' },
      { status: 500 }
    );
  }
}
```

### Step 2: Test the endpoint

Test with curl:
```bash
curl -X POST "http://localhost:3000/api/content-checks/mark-piece-found" \
  -H "Content-Type: application/json" \
  -d '{"check_id":"chk789","pieces_found":["2 red trains"],"notes":"Found under table","inspector_id":"staff123"}'
```

Expected response:
```json
{
  "success": true,
  "new_check_id": "chk_1234567890_abc",
  "message": "Piece recovery recorded successfully"
}
```

### Step 3: Commit mark-piece-found endpoint

```bash
git add app/api/content-checks/mark-piece-found/route.ts
git commit -m "feat: add mark piece found API endpoint

- POST /api/content-checks/mark-piece-found
- Create new check with type piece_recovery
- Record which pieces were found and where
- Link to original check via game_id

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Component - PlayLogStats

**Files:**
- Create: `components/features/staff/PlayLogStats.tsx`

### Step 1: Create PlayLogStats component

Create `components/features/staff/PlayLogStats.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StatsData {
  uniqueGames: number;
  totalPlays: number;
  mostPlayed: { game_name: string; count: number } | null;
  topLogger: { staff_name: string; count: number } | null;
  timePeriod: number;
}

export default function PlayLogStats() {
  const [timePeriod, setTimePeriod] = useState<string>('7');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats(timePeriod);
  }, [timePeriod]);

  const fetchStats = async (period: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/play-logs/stats?timePeriod=${period}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching play log stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Statistics</h2>
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Statistics</h2>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Unique Games</div>
          <div className="text-2xl font-bold">{stats?.uniqueGames || 0}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Plays</div>
          <div className="text-2xl font-bold">{stats?.totalPlays || 0}</div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Most Played</div>
          <div className="text-xl font-bold truncate">
            {stats?.mostPlayed?.game_name || '-'}
          </div>
          <div className="text-sm text-gray-500">
            {stats?.mostPlayed?.count ? `${stats.mostPlayed.count}x` : ''}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Top Logger</div>
          <div className="text-xl font-bold truncate">
            {stats?.topLogger?.staff_name || '-'}
          </div>
          <div className="text-sm text-gray-500">
            {stats?.topLogger?.count ? `${stats.topLogger.count}x` : ''}
          </div>
        </Card>
      </div>
    </div>
  );
}
```

### Step 2: Test component rendering

Add to an existing page temporarily to test:

In `app/staff/play-logs/page.tsx`, import and add:
```typescript
import PlayLogStats from '@/components/features/staff/PlayLogStats';

// Add above existing content:
<PlayLogStats />
```

Run: `npm run dev`
Visit: `http://localhost:3000/staff/play-logs`

Verify: Cards display with skeleton loader, then stats populate

### Step 3: Commit PlayLogStats component

```bash
git add components/features/staff/PlayLogStats.tsx
git commit -m "feat: add PlayLogStats component

- Display 4 stat cards in responsive grid
- Time period selector (7/30/90 days)
- Skeleton loading state
- Auto-fetch on period change

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Component - MissingPiecesInventory

**Files:**
- Create: `components/features/content-check/MissingPiecesInventory.tsx`

### Step 1: Create MissingPiecesInventory component

Create `components/features/content-check/MissingPiecesInventory.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface MissingPiece {
  piece_description: string;
  game_id: string;
  game_name: string;
  check_id: string;
  reported_by: string;
  reported_date: string;
  notes: string | null;
}

export default function MissingPiecesInventory() {
  const [pieces, setPieces] = useState<MissingPiece[]>([]);
  const [filteredPieces, setFilteredPieces] = useState<MissingPiece[]>([]);
  const [expandedPiece, setExpandedPiece] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMissingPieces();
  }, []);

  useEffect(() => {
    // Filter pieces based on search term
    if (searchTerm) {
      const filtered = pieces.filter((piece) =>
        piece.piece_description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredPieces(filtered);
    } else {
      setFilteredPieces(pieces);
    }
  }, [searchTerm, pieces]);

  const fetchMissingPieces = async () => {
    try {
      const response = await fetch('/api/content-checks/missing-pieces');
      if (response.ok) {
        const data = await response.json();
        setPieces(data.pieces);
        setFilteredPieces(data.pieces);
      }
    } catch (error) {
      console.error('Error fetching missing pieces:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (pieceDescription: string) => {
    setExpandedPiece(
      expandedPiece === pieceDescription ? null : pieceDescription
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Missing Pieces Inventory</h2>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-200 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Missing Pieces Inventory</h2>
        <p className="text-sm text-gray-600">
          {filteredPieces.length} missing pieces across{' '}
          {new Set(filteredPieces.map((p) => p.game_id)).size} games
        </p>
      </div>

      <Input
        placeholder="Search pieces..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredPieces.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            {searchTerm ? 'No pieces match your search' : 'All pieces accounted for!'}
          </p>
        ) : (
          filteredPieces.map((piece, index) => (
            <div key={`${piece.check_id}-${index}`} className="border rounded-lg">
              <button
                onClick={() => toggleExpand(piece.piece_description + index)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
              >
                <span className="font-medium">{piece.piece_description}</span>
                {expandedPiece === piece.piece_description + index ? (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedPiece === piece.piece_description + index && (
                <div className="p-3 border-t bg-gray-50 space-y-2">
                  <div>
                    <span className="text-sm font-medium">Game: </span>
                    <span className="text-sm">{piece.game_name}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Reported: </span>
                    <span className="text-sm">
                      {new Date(piece.reported_date).toLocaleDateString()} by{' '}
                      {piece.reported_by}
                    </span>
                  </div>
                  {piece.notes && (
                    <div>
                      <span className="text-sm font-medium">Note: </span>
                      <span className="text-sm">{piece.notes}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="default">
                      Mark Found
                    </Button>
                    <Button size="sm" variant="outline">
                      View Game
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
```

### Step 2: Test component

Add to check history page temporarily:
```typescript
import MissingPiecesInventory from '@/components/features/content-check/MissingPiecesInventory';

// Add to page:
<MissingPiecesInventory />
```

Verify:
- Collapsed list of pieces
- Click to expand shows game details
- Search filters pieces
- Empty state when no pieces

### Step 3: Commit MissingPiecesInventory component

```bash
git add components/features/content-check/MissingPiecesInventory.tsx
git commit -m "feat: add MissingPiecesInventory component

- Collapsible list of all missing pieces
- Search/filter by piece name
- Expand to show game, reporter, date
- Mark Found and View Game buttons

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Update Play Logs Page

**Files:**
- Modify: `app/staff/play-logs/page.tsx`

### Step 1: Add PlayLogStats to play logs page

In `app/staff/play-logs/page.tsx`, add the stats component at the top:

```typescript
import PlayLogStats from '@/components/features/staff/PlayLogStats';

// In the page component, add before the existing content:
export default function PlayLogsPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Play Logs</h1>

      {/* ADD THIS SECTION */}
      <PlayLogStats />

      {/* Existing play logs list */}
      <div className="space-y-4">
        {/* ... existing code ... */}
      </div>
    </div>
  );
}
```

### Step 2: Test the updated page

Run: `npm run dev`
Visit: `http://localhost:3000/staff/play-logs`

Verify:
- Stats cards appear at top
- Time period selector works
- Stats update when period changes
- Existing logs list still works below

### Step 3: Commit play logs page update

```bash
git add app/staff/play-logs/page.tsx
git commit -m "feat: add statistics to play logs page

- Add PlayLogStats component at top of page
- Display unique games, total plays, most played, top logger
- Existing logs list unchanged below stats

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: API Endpoints for Staff Dashboard

**Files:**
- Create: `app/api/staff/dashboard/stats/route.ts`
- Create: `app/api/staff/dashboard/priority-actions/route.ts`
- Create: `app/api/staff/dashboard/recent-activity/route.ts`

### Step 1: Create dashboard stats endpoint

Create `app/api/staff/dashboard/stats/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET() {
  try {
    // Games needing check (30 day threshold)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);
    const gamesNeedingCheckResult = await pool.query(
      `
      WITH latest_checks AS (
        SELECT game_id, MAX(check_date) as last_checked
        FROM content_checks
        GROUP BY game_id
      )
      SELECT COUNT(*) as count
      FROM games g
      LEFT JOIN latest_checks lc ON g.id = lc.game_id
      WHERE lc.last_checked IS NULL OR lc.last_checked < $1
      `,
      [thresholdDate.toISOString()]
    );

    // Play logs today
    const today = new Date().toISOString().split('T')[0];
    const playLogsTodayResult = await pool.query(
      'SELECT COUNT(*) as count FROM play_logs WHERE session_date >= $1',
      [today]
    );

    // Play logs this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const playLogsWeekResult = await pool.query(
      'SELECT COUNT(*) as count FROM play_logs WHERE session_date >= $1',
      [weekAgo.toISOString().split('T')[0]]
    );

    // Knowledge gaps (games with missing knowledge)
    const knowledgeGapsResult = await pool.query(`
      SELECT COUNT(DISTINCT g.id) as count
      FROM games g
      WHERE g.id NOT IN (
        SELECT DISTINCT game_id
        FROM staff_knowledge
        WHERE can_teach = true
      )
    `);

    return NextResponse.json({
      gamesNeedingCheck: parseInt(gamesNeedingCheckResult.rows[0].count),
      playLogsToday: parseInt(playLogsTodayResult.rows[0].count),
      playLogsThisWeek: parseInt(playLogsWeekResult.rows[0].count),
      knowledgeGaps: parseInt(knowledgeGapsResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
```

### Step 2: Create priority actions endpoint

Create `app/api/staff/dashboard/priority-actions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '5');

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);

    const result = await pool.query(
      `
      WITH latest_checks AS (
        SELECT
          game_id,
          MAX(check_date) as last_checked_date
        FROM content_checks
        GROUP BY game_id
      ),
      plays_since_check AS (
        SELECT
          pl.game_id,
          COUNT(*) as plays_count
        FROM play_logs pl
        LEFT JOIN latest_checks lc ON pl.game_id = lc.game_id
        WHERE pl.session_date > COALESCE(lc.last_checked_date, '1970-01-01'::timestamp)
        GROUP BY pl.game_id
      )
      SELECT
        g.id as game_id,
        g.name as name,
        lc.last_checked_date,
        COALESCE(psc.plays_count, 0) as plays_since_check,
        CASE
          WHEN lc.last_checked_date IS NULL THEN 999999
          ELSE EXTRACT(EPOCH FROM (NOW() - lc.last_checked_date)) / 86400
        END as days_since_check
      FROM games g
      LEFT JOIN latest_checks lc ON g.id = lc.game_id
      LEFT JOIN plays_since_check psc ON g.id = psc.game_id
      WHERE
        lc.last_checked_date IS NULL
        OR lc.last_checked_date < $1
      ORDER BY days_since_check DESC
      LIMIT $2
      `,
      [thresholdDate.toISOString(), limit]
    );

    const actions = result.rows.map((row) => ({
      game_id: row.game_id,
      name: row.name,
      days_since_check: row.last_checked_date
        ? Math.floor(parseFloat(row.days_since_check))
        : null,
      plays_since_check: parseInt(row.plays_since_check),
    }));

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Error fetching priority actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch priority actions' },
      { status: 500 }
    );
  }
}
```

### Step 3: Create recent activity endpoint

Create `app/api/staff/dashboard/recent-activity/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get recent content checks and play logs, combine and sort
    const checksResult = await pool.query(
      `
      SELECT
        'check' as type,
        cc.created_at as timestamp,
        sl.staff_name as staff_name,
        g.name as game_name,
        cc.check_type
      FROM content_checks cc
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      LEFT JOIN games g ON cc.game_id = g.id
      ORDER BY cc.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const logsResult = await pool.query(
      `
      SELECT
        'play' as type,
        pl.created_at as timestamp,
        sl.staff_name as staff_name,
        g.name as game_name
      FROM play_logs pl
      LEFT JOIN staff_list sl ON pl.staff_list_id = sl.stafflist_id
      LEFT JOIN games g ON pl.game_id = g.id
      ORDER BY pl.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    // Combine and sort by timestamp
    const activities = [...checksResult.rows, ...logsResult.rows]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map((row) => ({
        type: row.type,
        timestamp: row.timestamp,
        staff_name: row.staff_name || 'Unknown',
        game_name: row.game_name || 'Unknown Game',
        action:
          row.type === 'check'
            ? row.check_type === 'piece_recovery'
              ? 'recovered pieces for'
              : 'checked'
            : 'logged play',
      }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
}
```

### Step 4: Test dashboard endpoints

Test stats:
```bash
curl "http://localhost:3000/api/staff/dashboard/stats"
```

Test priority actions:
```bash
curl "http://localhost:3000/api/staff/dashboard/priority-actions?limit=5"
```

Test recent activity:
```bash
curl "http://localhost:3000/api/staff/dashboard/recent-activity?limit=10"
```

### Step 5: Commit dashboard endpoints

```bash
git add app/api/staff/dashboard/
git commit -m "feat: add staff dashboard API endpoints

- GET /api/staff/dashboard/stats (games needing check, play logs, knowledge gaps)
- GET /api/staff/dashboard/priority-actions (top N games needing checks)
- GET /api/staff/dashboard/recent-activity (combined checks and plays)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Create Staff Dashboard Page

**Files:**
- Create: `app/staff/dashboard/page.tsx`

### Step 1: Create dashboard page

Create `app/staff/dashboard/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, GamepadIcon, TrendingUp } from 'lucide-react';

interface DashboardStats {
  gamesNeedingCheck: number;
  playLogsToday: number;
  playLogsThisWeek: number;
  knowledgeGaps: number;
}

interface PriorityAction {
  game_id: string;
  name: string;
  days_since_check: number | null;
  plays_since_check: number;
}

interface Activity {
  type: string;
  timestamp: string;
  staff_name: string;
  game_name: string;
  action: string;
}

export default function StaffDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, actionsRes, activityRes] = await Promise.all([
        fetch('/api/staff/dashboard/stats'),
        fetch('/api/staff/dashboard/priority-actions?limit=5'),
        fetch('/api/staff/dashboard/recent-activity?limit=10'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (actionsRes.ok) {
        const actionsData = await actionsRes.json();
        setPriorityActions(actionsData.actions);
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData.activities);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Staff Dashboard</h1>
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="text-3xl font-bold">Staff Dashboard</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Games Need Checking</div>
            <CheckCircle2 className="h-5 w-5 text-orange-500" />
          </div>
          <div className="text-3xl font-bold">{stats?.gamesNeedingCheck || 0}</div>
          <Link href="/staff/check-history" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Play Logs</div>
            <GamepadIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold">{stats?.playLogsToday || 0}</div>
          <div className="text-sm text-gray-500 mt-1">
            {stats?.playLogsThisWeek || 0} this week
          </div>
          <Link href="/staff/play-logs" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">Learning Gaps</div>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold">{stats?.knowledgeGaps || 0}</div>
          <Link href="/staff/knowledge" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
            View all →
          </Link>
        </Card>
      </div>

      {/* Priority Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Priority Actions</h2>
        {priorityActions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            All games are up to date! ✅
          </p>
        ) : (
          <div className="space-y-2">
            {priorityActions.map((action) => (
              <div
                key={action.game_id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{action.name}</div>
                  <div className="text-sm text-gray-600">
                    {action.days_since_check
                      ? `${action.days_since_check} days`
                      : 'Never checked'}
                    {' • '}
                    {action.plays_since_check} plays since check
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/games/${action.game_id}`}>
                    Check Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            recentActivity.map((activity, index) => (
              <div key={index} className="text-sm py-2 border-b last:border-0">
                <span className="font-medium">{activity.staff_name}</span>
                <span className="text-gray-600"> {activity.action} </span>
                <span className="font-medium">{activity.game_name}</span>
                <span className="text-gray-400 ml-2">
                  • {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
```

### Step 2: Test dashboard page

Run: `npm run dev`
Visit: `http://localhost:3000/staff/dashboard`

Verify:
- 3 stat cards display
- Priority actions list shows games needing checks
- Recent activity shows checks and plays
- Links navigate to detail pages

### Step 3: Commit dashboard page

```bash
git add app/staff/dashboard/page.tsx
git commit -m "feat: create staff dashboard page

- Display quick stats cards (games needing check, play logs, knowledge gaps)
- Show priority actions (top 5 games needing checks)
- Recent activity stream (last 10 checks and plays)
- Links to detail pages

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Update Version and CHANGELOG

**Files:**
- Modify: `lib/version.ts`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

### Step 1: Update version in lib/version.ts

```typescript
export const VERSION = '1.10.0';
```

### Step 2: Update version in package.json

```json
{
  "version": "1.10.0"
}
```

### Step 3: Update CHANGELOG.md

Add at the top:

```markdown
## [1.10.0] - 2025-10-28

### Added
- **Staff Dashboard** - New mission control page with quick stats, priority actions, and recent activity
- **Play Logs Statistics** - 4-card statistics display (unique games, total plays, most played, top logger) with 7/30/90 day filters
- **Missing Pieces Inventory** - Scannable collapsed list of all missing pieces across games
- **Content Check Types** - Added `check_type` field to distinguish regular checks from piece recovery
- **Piece Recovery Workflow** - "Mark Found" creates audit trail when missing pieces are located
- **7 New API Endpoints**:
  - `GET /api/play-logs/stats` - Play log statistics by time period
  - `GET /api/content-checks/needs-checking` - Games needing checks based on days threshold
  - `GET /api/content-checks/missing-pieces` - Flattened inventory of all missing pieces
  - `POST /api/content-checks/mark-piece-found` - Record piece recovery
  - `GET /api/staff/dashboard/stats` - Dashboard overview statistics
  - `GET /api/staff/dashboard/priority-actions` - Top games needing checks
  - `GET /api/staff/dashboard/recent-activity` - Combined activity stream

### Enhanced
- **Play Logs Page** - Added statistics section at top with responsive grid layout
- **Content Checks Service** - Updated to handle `check_type` field for all queries
- **Database Schema** - Added `check_type` column to `content_checks` table

### Technical
- Added migration script for `check_type` column with default 'regular' value
- Updated TypeScript interfaces for ContentCheck with checkType field
- Created 3 new React components: PlayLogStats, MissingPiecesInventory
- All stat cards use responsive CSS Grid with mobile-first design
```

### Step 4: Commit version and changelog updates

```bash
git add lib/version.ts package.json CHANGELOG.md
git commit -m "v1.10.0 - Staff dashboard with statistics and missing pieces inventory

- New staff dashboard page as mission control
- Play logs statistics (unique games, total plays, most played, top logger)
- Missing pieces scannable inventory
- 7 new API endpoints for dashboard data
- Added check_type field for piece recovery workflow

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Build and Deploy to Main

**Note:** This task should only be done after user confirms "push to main"

### Step 1: Run production build

```bash
npm run build
```

Expected: Build completes with no errors

### Step 2: Test production build locally

```bash
npm run start
```

Visit pages:
- `http://localhost:3000/staff/dashboard`
- `http://localhost:3000/staff/play-logs`
- `http://localhost:3000/staff/check-history`

Verify: All pages load, stats display, no console errors

### Step 3: Push to main branch

```bash
git push origin main
```

Expected: Railway auto-deploys to production

### Step 4: Verify deployment

Visit: `https://sipnplay.cafe/staff/dashboard`

Verify:
- Dashboard loads
- Stats populate from production database
- All links work
- Mobile responsive

---

## Remaining Tasks (Phase 2)

The following tasks are planned but not yet implemented. These can be tackled in a future session:

### Task 13: Content Check History View Modes
- Add tabs: "Needs Checking" | "All Checks" | "Missing Pieces"
- Implement filters (days threshold, sort options)
- Add edit/delete for own records

### Task 14: Learning Opportunities Tool
- Create LearningOpportunityTool component
- API endpoint: `POST /api/staff-knowledge/learning-opportunities`
- Staff selector with checkboxes
- Time tier filter (Quick/Medium/Long)
- Results display with teacher → student pairings

### Task 15: Knowledge Gaps View
- API endpoint: `GET /api/staff-knowledge/gaps`
- Default view on Staff Knowledge page
- Show teachers (with confidence stars) and learners
- Include playtime for reference

### Task 16: Integration and Polish
- Add loading states to all components
- Empty state messages
- Error handling with retry buttons
- Accessibility improvements (ARIA labels, keyboard nav)
- Mobile responsiveness testing

---

## Testing Checklist

Before marking implementation complete:

- [ ] All API endpoints return correct data
- [ ] Dashboard stats cards display real data
- [ ] Priority actions list shows games needing checks
- [ ] Recent activity stream shows combined checks and plays
- [ ] Play logs statistics update when time period changes
- [ ] Missing pieces inventory is searchable and expandable
- [ ] Mobile layout works (cards stack vertically)
- [ ] Loading states display before data loads
- [ ] Empty states show appropriate messages
- [ ] All links navigate to correct pages
- [ ] Production build completes without errors
- [ ] Deployed site works on sipnplay.cafe

---

## Success Metrics

- Dashboard loads in < 2 seconds
- Stats API responds in < 500ms
- Missing pieces list is scannable in < 30 seconds
- Priority actions help staff identify checks quickly
- Mobile experience is smooth (no horizontal scroll)

---

## Notes for Future Development

- Consider adding filters to recent activity (by staff member, by type)
- Add "Mark as Taught" quick action on dashboard
- Implement notifications for urgent checks (> 60 days)
- Add charts/graphs for play log trends
- Consider pagination for missing pieces if list grows large
- Add export functionality for statistics (CSV download)
