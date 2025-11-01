# Changelog Page Implementation Guide

**Target:** Admin-only page to track all system changes and activity
**Mockup Reference:** `mockups/changelog-mockup.html`
**Route:** `/staff/changelog`

---

## Overview

The Changelog page will aggregate all database changes across:
- Board Games (edits, photo changes)
- Play Logs (new sessions)
- Staff Knowledge (additions, updates, deletions)
- Content Checks (new checks)

**Key Features:**
- Visual analytics (charts and stats cards)
- Sortable by Day/Week/Month and specific staff
- Filter by event type and category
- Pagination for large datasets

---

## 1. Database Schema Changes

### Option A: Create New `changelog` Table (Recommended)

```sql
CREATE TABLE changelog (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'photo_added'
  category VARCHAR(50) NOT NULL,   -- 'board_game', 'play_log', 'staff_knowledge', 'content_check'
  entity_id VARCHAR(255),           -- ID of the affected record
  entity_name VARCHAR(255),         -- Name/description for display
  description TEXT,                 -- Human-readable change description
  staff_member VARCHAR(255),        -- Who made the change
  staff_id UUID,                    -- Staff UUID for filtering (v1.19.0+)
  metadata JSONB,                   -- Additional data (e.g., old_value, new_value, photo_count)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_changelog_created_at ON changelog(created_at DESC);
CREATE INDEX idx_changelog_category ON changelog(category);
CREATE INDEX idx_changelog_staff_id ON changelog(staff_id);
CREATE INDEX idx_changelog_event_type ON changelog(event_type);
```

### Option B: Use Existing Timestamps (Less Comprehensive)

Query `created_at` and `updated_at` fields from existing tables:
- `games` table
- `play_logs` table
- `staff_knowledge` table
- `content_checks` table

**Limitation:** Cannot distinguish between event types (created vs. updated) or track deletions.

---

## 2. Event Type Definitions

### Event Types
| Event Type | Badge Color | Categories |
|------------|-------------|------------|
| `created` | Green (#dcfce7) | All |
| `updated` | Yellow (#fef3c7) | All |
| `deleted` | Red (#fee2e2) | All |
| `photo_added` | Blue (#dbeafe) | Board Games only |

### Category Definitions
| Category | Icon | Database Table |
|----------|------|----------------|
| `board_game` | 🎲 | `games` |
| `play_log` | 📊 | `play_logs` |
| `staff_knowledge` | 🧠 | `staff_knowledge` |
| `content_check` | ✓ | `content_checks` |

---

## 3. API Endpoints to Create

### `GET /api/changelog`

**Purpose:** Fetch paginated changelog entries with filters

**Query Parameters:**
```typescript
{
  startDate?: string;      // ISO date string
  endDate?: string;        // ISO date string
  staffId?: string;        // Filter by staff member
  eventType?: string;      // 'created', 'updated', 'deleted', 'photo_added'
  category?: string;       // 'board_game', 'play_log', 'staff_knowledge', 'content_check'
  page?: number;           // Page number (default: 1)
  limit?: number;          // Items per page (default: 20)
}
```

**Response:**
```typescript
{
  success: boolean;
  data: ChangelogEntry[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  stats: {
    totalChanges: number;
    gameUpdates: number;
    playLogsAdded: number;
    knowledgeUpdates: number;
  };
}
```

**Example Implementation:**
```typescript
// app/api/changelog/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const staffId = searchParams.get('staffId');
  const eventType = searchParams.get('eventType');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const offset = (page - 1) * limit;

  // Build WHERE clause dynamically
  const conditions = ['1=1'];
  const params: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(endDate);
  }
  if (staffId) {
    conditions.push(`staff_id = $${paramIndex++}`);
    params.push(staffId);
  }
  if (eventType) {
    conditions.push(`event_type = $${paramIndex++}`);
    params.push(eventType);
  }
  if (category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(category);
  }

  const whereClause = conditions.join(' AND ');

  // Fetch data
  const dataQuery = `
    SELECT * FROM changelog
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
  params.push(limit, offset);

  // Count total
  const countQuery = `
    SELECT COUNT(*) as total FROM changelog
    WHERE ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    query(dataQuery, params),
    query(countQuery, params.slice(0, -2))
  ]);

  const totalItems = parseInt(countResult.rows[0].total);
  const totalPages = Math.ceil(totalItems / limit);

  return NextResponse.json({
    success: true,
    data: dataResult.rows,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit
    }
  });
}
```

### `GET /api/changelog/stats`

**Purpose:** Get analytics data for charts

**Query Parameters:**
```typescript
{
  startDate: string;   // ISO date string
  endDate: string;     // ISO date string
  groupBy: 'day' | 'week' | 'month';
}
```

**Response:**
```typescript
{
  success: boolean;
  stats: {
    totalChanges: number;
    gameUpdates: number;
    playLogsAdded: number;
    knowledgeUpdates: number;
  };
  changesByDay: Array<{
    date: string;
    created: number;
    updated: number;
    deleted: number;
    photo_added: number;
  }>;
  changesByCategory: {
    board_game: number;
    play_log: number;
    staff_knowledge: number;
    content_check: number;
  };
  changesByStaff: Array<{
    staffName: string;
    totalChanges: number;
  }>;
}
```

---

## 4. Triggering Changelog Entries

### Modify Existing API Routes

**Pattern:** Add a helper function to log changes

```typescript
// lib/services/changelog-service.ts
import { query } from '@/lib/db';

export async function logChange(params: {
  eventType: 'created' | 'updated' | 'deleted' | 'photo_added';
  category: 'board_game' | 'play_log' | 'staff_knowledge' | 'content_check';
  entityId: string;
  entityName: string;
  description: string;
  staffMember: string;
  staffId: string;
  metadata?: Record<string, any>;
}) {
  const {
    eventType,
    category,
    entityId,
    entityName,
    description,
    staffMember,
    staffId,
    metadata
  } = params;

  try {
    await query(
      `INSERT INTO changelog (
        event_type, category, entity_id, entity_name,
        description, staff_member, staff_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventType,
        category,
        entityId,
        entityName,
        description,
        staffMember,
        staffId,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  } catch (error) {
    console.error('Failed to log change:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}
```

### Update API Routes

#### Board Games - Photo Added Event

**File:** `app/api/games/[id]/route.ts` (or wherever game updates happen)

```typescript
// When photos are added/updated
import { logChange } from '@/lib/services/changelog-service';

export async function PATCH(request: NextRequest) {
  // ... existing update logic ...

  const oldPhotoCount = existingGame.images?.length || 0;
  const newPhotoCount = updatedGame.images?.length || 0;

  if (newPhotoCount > oldPhotoCount) {
    const photosAdded = newPhotoCount - oldPhotoCount;

    await logChange({
      eventType: 'photo_added',
      category: 'board_game',
      entityId: gameId,
      entityName: updatedGame.name,
      description: `Updated images for ${updatedGame.name} (added ${photosAdded} photo${photosAdded > 1 ? 's' : ''})`,
      staffMember: staffName,
      staffId: staffId,
      metadata: {
        oldCount: oldPhotoCount,
        newCount: newPhotoCount,
        photosAdded
      }
    });
  }

  // ... rest of logic ...
}
```

#### Play Logs

**File:** `app/api/play-logs/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // ... create play log ...

  await logChange({
    eventType: 'created',
    category: 'play_log',
    entityId: newPlayLog.id,
    entityName: gameName,
    description: `New play session logged for ${gameName}${
      duration ? ` (${duration} hours)` : ''
    }`,
    staffMember: staffName,
    staffId: staffId,
    metadata: { duration }
  });
}

export async function DELETE(request: NextRequest) {
  // ... delete play log ...

  await logChange({
    eventType: 'deleted',
    category: 'play_log',
    entityId: playLogId,
    entityName: gameName,
    description: `Removed play log for ${gameName}`,
    staffMember: staffName,
    staffId: staffId
  });
}
```

#### Staff Knowledge

**File:** `app/api/staff-knowledge/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // ... create knowledge entry ...

  await logChange({
    eventType: 'created',
    category: 'staff_knowledge',
    entityId: newEntry.id,
    entityName: gameName,
    description: `Added knowledge entry: ${gameName} - ${confidenceLevel} level`,
    staffMember: staffName,
    staffId: staffId,
    metadata: { confidenceLevel, canTeach }
  });
}

export async function PATCH(request: NextRequest) {
  // ... update knowledge entry ...

  await logChange({
    eventType: 'updated',
    category: 'staff_knowledge',
    entityId: entryId,
    entityName: gameName,
    description: `Updated confidence level for ${gameName} (${oldLevel} → ${newLevel})`,
    staffMember: staffName,
    staffId: staffId,
    metadata: { oldLevel, newLevel }
  });
}

export async function DELETE(request: NextRequest) {
  // ... delete knowledge entry ...

  await logChange({
    eventType: 'deleted',
    category: 'staff_knowledge',
    entityId: entryId,
    entityName: gameName,
    description: `Removed knowledge entry for ${gameName}`,
    staffMember: staffName,
    staffId: staffId
  });
}
```

#### Content Checks

**File:** `app/api/content-checks/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // ... create content check ...

  await logChange({
    eventType: 'created',
    category: 'content_check',
    entityId: newCheck.id,
    entityName: gameName,
    description: `Content check completed for ${gameName} - ${status}`,
    staffMember: staffName,
    staffId: staffId,
    metadata: { status, notes }
  });
}
```

---

## 5. Frontend Implementation

### File Structure

```
app/staff/changelog/
  └── page.tsx                 # Main changelog page

components/features/changelog/
  ├── ChangelogFilters.tsx     # Filter controls
  ├── ChangelogStats.tsx       # Stats cards
  ├── ChangelogCharts.tsx      # Bar/pie/staff charts
  ├── ChangelogTable.tsx       # Data table
  └── EventBadge.tsx           # Event type badge component

lib/services/
  └── changelog-service.ts     # API client functions

types/
  └── index.ts                 # Add Changelog types
```

### Type Definitions

**File:** `types/index.ts`

```typescript
export interface ChangelogEntry {
  id: string;
  event_type: 'created' | 'updated' | 'deleted' | 'photo_added';
  category: 'board_game' | 'play_log' | 'staff_knowledge' | 'content_check';
  entity_id: string;
  entity_name: string;
  description: string;
  staff_member: string;
  staff_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ChangelogFilters {
  startDate: string;
  endDate: string;
  staffId: string | null;
  eventType: string | null;
  category: string | null;
  myChangesOnly: boolean;
}

export interface ChangelogStats {
  totalChanges: number;
  gameUpdates: number;
  playLogsAdded: number;
  knowledgeUpdates: number;
}

export interface ChangelogChartData {
  changesByDay: Array<{
    date: string;
    created: number;
    updated: number;
    deleted: number;
    photo_added: number;
  }>;
  changesByCategory: {
    board_game: number;
    play_log: number;
    staff_knowledge: number;
    content_check: number;
  };
  changesByStaff: Array<{
    staffName: string;
    totalChanges: number;
  }>;
}
```

### Main Page Component

**File:** `app/staff/changelog/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChangelogFilters } from '@/components/features/changelog/ChangelogFilters';
import { ChangelogStats } from '@/components/features/changelog/ChangelogStats';
import { ChangelogCharts } from '@/components/features/changelog/ChangelogCharts';
import { ChangelogTable } from '@/components/features/changelog/ChangelogTable';
import type { ChangelogEntry, ChangelogFilters as Filters } from '@/types';

export default function ChangelogPage() {
  const router = useRouter();
  const [staffName, setStaffName] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [filters, setFilters] = useState<Filters>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    staffId: null,
    eventType: null,
    category: null,
    myChangesOnly: false
  });
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('week');

  // Auth check
  useEffect(() => {
    const name = localStorage.getItem('staff_name');
    const id = localStorage.getItem('staff_id');
    const staffType = localStorage.getItem('staff_type');

    if (!name || staffType !== 'Admin') {
      router.push('/auth/signin');
      return;
    }

    setStaffName(name);
    setStaffId(id || '');
  }, [router]);

  // Fetch changelog data
  const fetchChangelog = async () => {
    setLoading(true);

    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: '20'
    });

    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.myChangesOnly && staffId) params.append('staffId', staffId);
    else if (filters.staffId) params.append('staffId', filters.staffId);
    if (filters.eventType) params.append('eventType', filters.eventType);
    if (filters.category) params.append('category', filters.category);

    try {
      const response = await fetch(`/api/changelog?${params}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data);
        setTotalPages(data.pagination.totalPages);
        setTotalItems(data.pagination.totalItems);
      }
    } catch (error) {
      console.error('Failed to fetch changelog:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (staffId) {
      fetchChangelog();
    }
  }, [filters, currentPage, staffId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <a
            href="/staff"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors"
          >
            <span>←</span>
            <span>Back to Staff Menu</span>
          </a>
          <h1 className="text-3xl font-bold">Changelog</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Track all system changes and activity
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Logged in as: <strong>{staffName}</strong>
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <ChangelogFilters
          filters={filters}
          timePeriod={timePeriod}
          onFiltersChange={setFilters}
          onTimePeriodChange={setTimePeriod}
        />

        <ChangelogStats
          startDate={filters.startDate}
          endDate={filters.endDate}
        />

        <ChangelogCharts
          startDate={filters.startDate}
          endDate={filters.endDate}
          timePeriod={timePeriod}
        />

        <ChangelogTable
          entries={entries}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
```

### EventBadge Component

**File:** `components/features/changelog/EventBadge.tsx`

```typescript
interface EventBadgeProps {
  eventType: 'created' | 'updated' | 'deleted' | 'photo_added';
}

export function EventBadge({ eventType }: EventBadgeProps) {
  const badgeStyles = {
    created: 'bg-green-50 text-green-700',
    updated: 'bg-yellow-50 text-yellow-700',
    deleted: 'bg-red-50 text-red-700',
    photo_added: 'bg-blue-50 text-blue-700'
  };

  const badgeLabels = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    photo_added: 'Photo Added'
  };

  return (
    <span
      className={`inline-block px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${badgeStyles[eventType]}`}
    >
      {badgeLabels[eventType]}
    </span>
  );
}
```

---

## 6. Charts Implementation

**Install Dependencies:**
```bash
npm install chart.js react-chartjs-2
```

**File:** `components/features/changelog/ChangelogCharts.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  startDate: string;
  endDate: string;
  timePeriod: 'day' | 'week' | 'month';
}

export function ChangelogCharts({ startDate, endDate, timePeriod }: Props) {
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    fetchChartData();
  }, [startDate, endDate, timePeriod]);

  const fetchChartData = async () => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      groupBy: timePeriod
    });

    const response = await fetch(`/api/changelog/stats?${params}`);
    const data = await response.json();

    if (data.success) {
      setChartData(data);
    }
  };

  if (!chartData) return <div>Loading charts...</div>;

  // Bar chart data
  const barChartData = {
    labels: chartData.changesByDay.map((d: any) => d.date),
    datasets: [
      {
        label: 'Created',
        data: chartData.changesByDay.map((d: any) => d.created),
        backgroundColor: '#dcfce7',
        borderColor: '#16a34a',
        borderWidth: 1
      },
      {
        label: 'Updated',
        data: chartData.changesByDay.map((d: any) => d.updated),
        backgroundColor: '#fef3c7',
        borderColor: '#ca8a04',
        borderWidth: 1
      },
      {
        label: 'Deleted',
        data: chartData.changesByDay.map((d: any) => d.deleted),
        backgroundColor: '#fee2e2',
        borderColor: '#dc2626',
        borderWidth: 1
      },
      {
        label: 'Photo Added',
        data: chartData.changesByDay.map((d: any) => d.photo_added),
        backgroundColor: '#dbeafe',
        borderColor: '#2563eb',
        borderWidth: 1
      }
    ]
  };

  // Pie chart data
  const pieChartData = {
    labels: ['Board Games', 'Play Logs', 'Staff Knowledge', 'Content Checks'],
    datasets: [{
      data: [
        chartData.changesByCategory.board_game,
        chartData.changesByCategory.play_log,
        chartData.changesByCategory.staff_knowledge,
        chartData.changesByCategory.content_check
      ],
      backgroundColor: ['#93c5fd', '#a78bfa', '#fcd34d', '#86efac'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Changes by Day</h3>
          <Bar data={barChartData} options={{ responsive: true }} />
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Changes by Category</h3>
          <Pie data={pieChartData} options={{ responsive: true }} />
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Play Logs Sorting by Complexity

### Update Play Logs Page

**File:** `app/staff/play-logs/page.tsx`

```typescript
// Add to sort options
const sortOptions = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'game', label: 'Game Name (A-Z)' },
  { value: 'staff', label: 'Staff Name (A-Z)' },
  { value: 'duration', label: 'Duration' },
  { value: 'complexity', label: 'Complexity' } // NEW
];

// Add to sort logic
const sortedLogs = (() => {
  const sorted = [...filteredLogs];

  switch (sortBy) {
    case 'recent':
      return sorted.sort((a, b) =>
        new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
      );
    case 'game':
      return sorted.sort((a, b) => a.gameName.localeCompare(b.gameName));
    case 'staff':
      return sorted.sort((a, b) => a.staffName.localeCompare(b.staffName));
    case 'duration':
      return sorted.sort((a, b) => (b.durationHours || 0) - (a.durationHours || 0));
    case 'complexity': // NEW
      return sorted.sort((a, b) => {
        const complexityOrder = { Light: 1, Medium: 2, Heavy: 3 };
        const aComplexity = complexityOrder[a.gameComplexity as keyof typeof complexityOrder] || 0;
        const bComplexity = complexityOrder[b.gameComplexity as keyof typeof complexityOrder] || 0;
        return bComplexity - aComplexity;
      });
    default:
      return sorted;
  }
})();
```

### Update Play Logs API

**File:** `app/api/play-logs/route.ts`

```typescript
// Ensure play logs include game complexity
const query = `
  SELECT
    pl.*,
    g.name as game_name,
    g.complexity as game_complexity  -- NEW
  FROM play_logs pl
  JOIN games g ON pl.game_id = g.id
  ORDER BY pl.session_date DESC
`;
```

### Update PlayLogEntry Type

**File:** `types/index.ts`

```typescript
export interface PlayLogEntry {
  id: string;
  gameId: string;
  gameName: string;
  gameComplexity?: 'Light' | 'Medium' | 'Heavy'; // NEW
  staffName: string;
  sessionDate: string;
  durationHours?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 8. Staff Menu Navigation

**File:** `components/features/staff/StaffMenu.tsx`

```typescript
// Add new menu item
const menuItems = [
  {
    title: 'Play Logs',
    href: '/staff/play-logs',
    icon: '📊',
    description: 'Track game play sessions'
  },
  {
    title: 'Check History',
    href: '/staff/check-history',
    icon: '✓',
    description: 'View content check logs'
  },
  {
    title: 'Staff Knowledge',
    href: '/staff/knowledge',
    icon: '🧠',
    description: 'Manage game expertise',
    subItems: [
      {
        title: 'Bulk Knowledge Updater',
        href: '/staff/add-knowledge',
        icon: '⭐'
      }
    ]
  },
  // NEW ITEM
  {
    title: 'Changelog',
    href: '/staff/changelog',
    icon: '📋',
    description: 'View system activity log',
    adminOnly: true  // Only show to admins
  }
];
```

---

## 9. Testing Checklist

- [ ] Database table created and indexed
- [ ] API endpoint `/api/changelog` returns filtered data
- [ ] API endpoint `/api/changelog/stats` returns chart data
- [ ] All CRUD operations log to changelog table
- [ ] Photo additions trigger `photo_added` event
- [ ] Filters work correctly (date range, staff, event type, category)
- [ ] Time period toggle updates date range
- [ ] Charts render with correct data
- [ ] Stats cards show accurate counts
- [ ] Pagination works correctly
- [ ] "My Changes Only" checkbox filters properly
- [ ] Play Logs can be sorted by complexity
- [ ] Admin-only access enforced
- [ ] Mobile responsive layout works

---

## 10. Migration Script

**File:** `scripts/migrate-changelog.sql`

```sql
-- Create changelog table
CREATE TABLE IF NOT EXISTS changelog (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  entity_name VARCHAR(255),
  description TEXT,
  staff_member VARCHAR(255),
  staff_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_changelog_created_at ON changelog(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_category ON changelog(category);
CREATE INDEX IF NOT EXISTS idx_changelog_staff_id ON changelog(staff_id);
CREATE INDEX IF NOT EXISTS idx_changelog_event_type ON changelog(event_type);

-- Optional: Backfill from existing data
INSERT INTO changelog (event_type, category, entity_id, entity_name, description, staff_member, staff_id, created_at)
SELECT
  'created' as event_type,
  'play_log' as category,
  id::text as entity_id,
  game_name as entity_name,
  'Play session logged for ' || game_name as description,
  staff_name as staff_member,
  staff_id,
  created_at
FROM play_logs
WHERE created_at IS NOT NULL;

-- Add more backfill queries for other tables as needed
```

---

## 11. Optional Enhancements

### Real-time Updates
- Use WebSocket or Server-Sent Events to push new changelog entries to connected clients
- Display notification badge when new changes occur

### Export Functionality
- Add "Export to CSV" button for filtered changelog data
- Generate PDF reports for specific date ranges

### Change Comparison
- For `updated` events, store `old_value` and `new_value` in metadata
- Show diff view when clicking on an update event

### Aggregated Summaries
- Weekly/monthly email digest of all changes
- Dashboard widget showing "Changes this week" summary

### Audit Trail
- Link changelog entries back to original records
- Click on entry to view the affected game/log/knowledge entry

---

## Summary

**Implementation Priority:**

1. **Phase 1: Database & API** (1-2 hours)
   - Create `changelog` table
   - Build `/api/changelog` and `/api/changelog/stats` endpoints
   - Create `changelog-service.ts` helper

2. **Phase 2: Logging Integration** (2-3 hours)
   - Update all CRUD API routes to call `logChange()`
   - Add `photo_added` event tracking
   - Test all event types

3. **Phase 3: Frontend** (3-4 hours)
   - Build changelog page with filters
   - Implement stats cards
   - Add charts using Chart.js
   - Create table with pagination

4. **Phase 4: Polish** (1-2 hours)
   - Add Play Logs complexity sorting
   - Update staff menu navigation
   - Mobile responsive testing
   - Admin access enforcement

**Total Estimated Time:** 7-11 hours

---

## Future Features / Backlog

### 1. Play History in Game Detail Modal
**Priority:** Medium
**Complexity:** High
**Description:** Add "Play History" button/section in Game Detail Modal showing all play log sessions for that specific game.

**Requirements:**
- New API endpoint: `GET /api/games/[id]/play-history`
- Query play_logs table filtered by game_id
- Join with staff_list to get staff names
- Display in modal as timeline or list
- Include session date, staff member, duration, and notes
- Sort by most recent first
- Show total play count and average duration stats

**Files to Create/Modify:**
- `app/api/games/[id]/play-history/route.ts` (new)
- `components/features/games/GameDetailModal.tsx` (modify)
- `components/features/games/PlayHistorySection.tsx` (new component)
- `types/index.ts` (add PlayHistoryEntry interface)

**Implementation Notes:**
- Add tab/section in GameDetailModal
- Use collapsible/expandable UI for long lists
- Include filters for date range and staff member
- Consider pagination for games with 50+ sessions

**Estimated Time:** 3-4 hours

---

### 2. "My Knowledge" Filter in Games Gallery
**Priority:** Medium
**Complexity:** Medium
**Description:** Add filter option in main games gallery to show only games the current staff member has knowledge entries for.

**Requirements:**
- Add "My Knowledge Only" checkbox to GameFilters component
- Fetch staff knowledge entries for current user
- Filter games list to only show games with matching knowledge records
- Visual indicator (badge/icon) on game cards showing user's confidence level
- Quick filter button for easy toggle

**Files to Create/Modify:**
- `app/games/page.tsx` (modify - add filter state)
- `components/features/games/GameFilters.tsx` (modify - add checkbox)
- `types/index.ts` (modify - extend GameFilters interface)

**Implementation Notes:**
- Could show confidence level badge on filtered games
- Consider combining with existing knowledge tick overlay
- Add to URL query params for shareable links
- Persist preference in localStorage

**Type Changes Needed:**
```typescript
// types/index.ts
export interface GameFilters {
  // ... existing filters
  myKnowledgeOnly?: boolean;
}

// Extend BoardGame to optionally include staff knowledge
export interface BoardGame {
  // ... existing fields
  staffKnowledge?: {
    confidenceLevel: number;
    canTeach: boolean;
  };
}
```

**Estimated Time:** 2-3 hours

---

**Mockup Reference:** See `mockups/changelog-mockup.html` for complete visual design
