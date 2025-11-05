# Phase 7: Points System Analytics & Persistent UI

**Priority**: 🟡 Medium
**Effort**: Large (2-2.5 hours)
**Dependencies**: Phase 4 (Staff Nickname System)
**Affects**: Changelog analytics page, global header

---

## Issues Addressed

### Issue #7: Points System Analytics
Add points statistics to Changelog analytics page (`/staff/changelog`):
- Change "Staff Activity Over Time" to "Staff Points Over Time"
- Show point changes for all staff & per team
- Time-based filtering
- Work with existing filters

### Issue #9: Persistent Logged-In User Display
Make logged-in user and their total points persistent across all pages like a sticky notification.

---

## Part 1: Points Analytics in Changelog

### Current State

**File**: [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx)

**Current Analytics:**
- Staff Activity Over Time (line chart showing number of activities)
- Activity by Category (pie chart)
- Activity Distribution (bar chart)

### Target State

**New Analytics:**
- **Staff Points Over Time** (replaces Activity Over Time)
  - Line chart showing cumulative points
  - One line per staff member (or filtered staff)
  - X-axis: Time (by day/week/month)
  - Y-axis: Points
  - Legend with nicknames

**Additional:**
- **Total Points by Staff** (bar chart)
  - Show all staff members
  - Sorted by points (descending)
  - Use nicknames

- **Points by Category** (pie chart)
  - Show how points are earned (content check, play log, tasks, etc.)

### Implementation

#### Step 1: Update Analytics API

**File**: [app/api/changelog/stats/route.ts](../../app/api/changelog/stats/route.ts)

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const staffId = searchParams.get('staffId');
    const category = searchParams.get('category');

    // Build WHERE clause
    let whereConditions = ['1=1'];
    const params: any[] = [];

    if (startDate) {
      params.push(startDate);
      whereConditions.push(`created_at >= $${params.length}`);
    }
    if (endDate) {
      params.push(endDate);
      whereConditions.push(`created_at <= $${params.length}`);
    }
    if (staffId) {
      params.push(staffId);
      whereConditions.push(`staff_id = $${params.length}`);
    }
    if (category) {
      params.push(category);
      whereConditions.push(`category = $${params.length}`);
    }

    const whereClause = whereConditions.join(' AND ');

    // Query 1: Points over time by staff
    const pointsOverTime = await sql`
      SELECT
        DATE(c.created_at) as date,
        sl.nickname,
        sl.full_name,
        SUM(
          COALESCE(
            (c.metadata->>'points_earned')::INTEGER,
            (c.metadata->>'points')::INTEGER,
            0
          )
        ) as points_earned
      FROM changelog c
      JOIN staff_list sl ON c.staff_id = sl.id
      WHERE ${whereClause}
      GROUP BY DATE(c.created_at), sl.id, sl.nickname, sl.full_name
      ORDER BY date ASC, sl.nickname ASC;
    `;

    // Query 2: Total points by staff
    const totalPointsByStaff = await sql`
      SELECT
        sl.nickname,
        sl.full_name,
        SUM(
          COALESCE(
            (c.metadata->>'points_earned')::INTEGER,
            (c.metadata->>'points')::INTEGER,
            0
          )
        ) as total_points
      FROM changelog c
      JOIN staff_list sl ON c.staff_id = sl.id
      WHERE ${whereClause}
      GROUP BY sl.id, sl.nickname, sl.full_name
      ORDER BY total_points DESC;
    `;

    // Query 3: Points by category
    const pointsByCategory = await sql`
      SELECT
        c.category,
        SUM(
          COALESCE(
            (c.metadata->>'points_earned')::INTEGER,
            (c.metadata->>'points')::INTEGER,
            0
          )
        ) as total_points
      FROM changelog c
      WHERE ${whereClause}
      GROUP BY c.category
      ORDER BY total_points DESC;
    `;

    // Query 4: Cumulative points over time (for line chart)
    const cumulativePoints = await sql`
      WITH daily_points AS (
        SELECT
          DATE(c.created_at) as date,
          sl.id as staff_id,
          sl.nickname,
          sl.full_name,
          SUM(
            COALESCE(
              (c.metadata->>'points_earned')::INTEGER,
              (c.metadata->>'points')::INTEGER,
              0
            )
          ) as daily_points
        FROM changelog c
        JOIN staff_list sl ON c.staff_id = sl.id
        WHERE ${whereClause}
        GROUP BY DATE(c.created_at), sl.id, sl.nickname, sl.full_name
      )
      SELECT
        date,
        staff_id,
        nickname,
        full_name,
        daily_points,
        SUM(daily_points) OVER (
          PARTITION BY staff_id
          ORDER BY date
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as cumulative_points
      FROM daily_points
      ORDER BY date ASC, nickname ASC;
    `;

    return NextResponse.json({
      pointsOverTime: pointsOverTime.rows,
      totalPointsByStaff: totalPointsByStaff.rows,
      pointsByCategory: pointsByCategory.rows,
      cumulativePoints: cumulativePoints.rows,
    });
  } catch (error) {
    console.error('[API] Error fetching changelog stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
```

#### Step 2: Update Frontend Charts

**File**: [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx)

Install chart library if not already:
```bash
npm install recharts
```

**Replace "Staff Activity Over Time" with "Staff Points Over Time":**

```tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Fetch stats
const [stats, setStats] = useState<any>(null);

useEffect(() => {
  const params = new URLSearchParams({
    ...(startDate && { startDate: startDate.toISOString() }),
    ...(endDate && { endDate: endDate.toISOString() }),
    ...(selectedStaff && { staffId: selectedStaff }),
    ...(selectedCategory && { category: selectedCategory }),
  });

  fetch(`/api/changelog/stats?${params}`)
    .then((res) => res.json())
    .then((data) => setStats(data))
    .catch((err) => console.error('Error fetching stats:', err));
}, [startDate, endDate, selectedStaff, selectedCategory]);

// Chart: Staff Points Over Time
<Card>
  <CardHeader>
    <CardTitle>Staff Points Over Time</CardTitle>
  </CardHeader>
  <CardContent>
    {stats?.cumulativePoints && (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formatCumulativePointsForChart(stats.cumulativePoints)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          {getUniqueStaff(stats.cumulativePoints).map((staff, index) => (
            <Line
              key={staff.staff_id}
              type="monotone"
              dataKey={staff.nickname}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )}
  </CardContent>
</Card>

// Chart: Total Points by Staff
<Card>
  <CardHeader>
    <CardTitle>Total Points by Staff</CardTitle>
  </CardHeader>
  <CardContent>
    {stats?.totalPointsByStaff && (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={stats.totalPointsByStaff}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="nickname" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total_points" fill="#fbbf24" />
        </BarChart>
      </ResponsiveContainer>
    )}
  </CardContent>
</Card>

// Chart: Points by Category
<Card>
  <CardHeader>
    <CardTitle>Points by Category</CardTitle>
  </CardHeader>
  <CardContent>
    {stats?.pointsByCategory && (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={stats.pointsByCategory}
            dataKey="total_points"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {stats.pointsByCategory.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    )}
  </CardContent>
</Card>
```

#### Step 3: Helper Functions

```tsx
const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const formatCumulativePointsForChart = (data: any[]) => {
  // Group by date and create object with staff as keys
  const grouped: any = {};

  data.forEach((item) => {
    const date = item.date;
    if (!grouped[date]) {
      grouped[date] = { date };
    }
    grouped[date][item.nickname] = item.cumulative_points;
  });

  return Object.values(grouped);
};

const getUniqueStaff = (data: any[]) => {
  const staffMap = new Map();
  data.forEach((item) => {
    if (!staffMap.has(item.staff_id)) {
      staffMap.set(item.staff_id, {
        staff_id: item.staff_id,
        nickname: item.nickname,
        full_name: item.full_name,
      });
    }
  });
  return Array.from(staffMap.values());
};
```

---

## Part 2: Persistent Logged-In User Display

### Implementation

Create a sticky header component that shows logged-in staff info.

#### Step 1: Create Persistent Header Component

**File**: [components/features/staff/PersistentStaffHeader.tsx](../../components/features/staff/PersistentStaffHeader.tsx) (new)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Star, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PersistentStaffHeader() {
  const [staffInfo, setStaffInfo] = useState<{
    name: string;
    points: number;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if staff is logged in
    const staffId = localStorage.getItem('staff_id');
    if (!staffId) return;

    // Fetch staff info
    fetch(`/api/staff/points?staffId=${staffId}`)
      .then((res) => res.json())
      .then((data) => {
        setStaffInfo({
          name: data.nickname || data.full_name,
          points: data.points || 0,
        });
        setIsVisible(true);
      })
      .catch((err) => console.error('Error fetching staff info:', err));
  }, []);

  if (!isVisible || !staffInfo) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-yellow-400 to-yellow-500 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-yellow-900">
          <User className="h-4 w-4" />
          <span>Logged in as: {staffInfo.name}</span>
        </div>

        <div className="flex items-center gap-1 text-sm font-bold text-yellow-900">
          <Star className="h-4 w-4 fill-yellow-600" />
          <span>{staffInfo.points.toLocaleString()} points</span>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2: Add to Root Layout

**File**: [app/layout.tsx](../../app/layout.tsx)

```tsx
import { PersistentStaffHeader } from '@/components/features/staff/PersistentStaffHeader';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Persistent Staff Header */}
        <PersistentStaffHeader />

        {/* Add padding to compensate for fixed header */}
        <div className="pt-10">
          {children}
        </div>
      </body>
    </html>
  );
}
```

#### Step 3: Alternative: Floating Badge

If fixed header is too intrusive, use a floating badge:

```tsx
export function PersistentStaffBadge() {
  // ... same state logic

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-400 text-yellow-900 rounded-full shadow-lg px-4 py-2 flex items-center gap-2 text-sm font-medium hover:bg-yellow-500 transition-colors">
      <User className="h-4 w-4" />
      <span>{staffInfo.name}</span>
      <div className="h-4 w-px bg-yellow-600" />
      <Star className="h-4 w-4 fill-yellow-600" />
      <span className="font-bold">{staffInfo.points}</span>
    </div>
  );
}
```

---

## Implementation Steps

### Step 1: Update Changelog Stats API
1. Open [app/api/changelog/stats/route.ts](../../app/api/changelog/stats/route.ts)
2. Add points-based queries (cumulative, by staff, by category)
3. Test API with various filters

### Step 2: Update Changelog Page Charts
1. Open [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx)
2. Replace "Staff Activity Over Time" with "Staff Points Over Time"
3. Add "Total Points by Staff" chart
4. Add "Points by Category" chart
5. Implement helper functions for data formatting

### Step 3: Create Persistent Header Component
1. Create [components/features/staff/PersistentStaffHeader.tsx](../../components/features/staff/PersistentStaffHeader.tsx)
2. Implement staff info fetching
3. Style as sticky header or floating badge

### Step 4: Add to Root Layout
1. Open [app/layout.tsx](../../app/layout.tsx)
2. Import PersistentStaffHeader
3. Add component above main content
4. Add padding to compensate for fixed header

### Step 5: Test Points Analytics
1. Navigate to `/staff/changelog`
2. Verify "Staff Points Over Time" displays correctly
3. Test date range filtering
4. Test staff filtering
5. Test category filtering
6. Verify nicknames display on charts

### Step 6: Test Persistent Header
1. Login as staff member
2. Navigate to different pages
3. Verify header stays visible
4. Verify points update after earning points
5. Test on mobile devices

### Step 7: Commit and Deploy
```bash
git add .
git commit -m "v1.5.6 - Points analytics and persistent staff header

- Add Staff Points Over Time chart to changelog
- Add Total Points by Staff chart
- Add Points by Category chart
- Create persistent staff header showing name and points
- Use nicknames in all displays

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

### Points Analytics
- [ ] Changelog stats API returns points data
- [ ] Staff Points Over Time chart displays correctly
- [ ] Line chart shows cumulative points
- [ ] One line per staff member with nickname
- [ ] Total Points by Staff bar chart displays
- [ ] Points by Category pie chart displays
- [ ] Filters work with all charts
- [ ] Date range filtering works
- [ ] Staff filtering works
- [ ] Category filtering works

### Persistent Header
- [ ] Header appears when staff logged in
- [ ] Header shows staff nickname
- [ ] Header shows correct points
- [ ] Header stays visible on scroll
- [ ] Header appears on all pages
- [ ] Points update after earning points
- [ ] Header doesn't appear for non-staff users
- [ ] Mobile responsive

---

## Rollback Plan

If issues arise:
1. Remove PersistentStaffHeader from layout
2. Revert changelog stats API changes
3. Revert changelog page chart changes
4. Redeploy previous version

---

## Estimated Timeline

- **Stats API Updates**: 30 minutes
- **Chart Implementation**: 60 minutes
- **Persistent Header**: 30 minutes
- **Testing**: 30 minutes
- **Total**: ~2.5 hours

---

## Related Files

### New Files
- [components/features/staff/PersistentStaffHeader.tsx](../../components/features/staff/PersistentStaffHeader.tsx)

### Modified Files
- [app/api/changelog/stats/route.ts](../../app/api/changelog/stats/route.ts)
- [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx)
- [app/layout.tsx](../../app/layout.tsx)

---

## Notes

- Use `recharts` library for charts (already used elsewhere in project)
- Cumulative points calculation uses window function
- Persistent header uses z-index 50 to stay above content
- Consider adding points refresh button to header (future enhancement)
- Chart colors cycle through predefined palette
- Mobile users may prefer floating badge over fixed header
