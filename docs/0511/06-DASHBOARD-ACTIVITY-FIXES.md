# Phase 6: Dashboard & Activity Improvements

**Priority**: 🟡 Medium
**Effort**: Medium (1 hour)
**Dependencies**: Phase 4 (Staff Nickname System)
**Affects**: Staff dashboard Recent Activity section

---

## Issues Addressed

### Issue #11: Add Points to Recent Activity
Recent Activity entries should show points earned for that activity.

### Issue #12: Fix Missing Point Action Categories
Some point actions don't appear properly in Recent Activity:
- "issue report" category
- "points config" category
- "task" category

These appear correctly in Admin Changelog but not in Dashboard Recent Activity.

---

## Root Cause Analysis

### Current Implementation

**Recent Activity API**: [app/api/staff/dashboard/recent-activity/route.ts](../../app/api/staff/dashboard/recent-activity/route.ts)

Fetches from `changelog` table:
```sql
SELECT * FROM changelog
WHERE staff_id = $1
ORDER BY created_at DESC
LIMIT 10;
```

**Admin Changelog**: [app/api/changelog/route.ts](../../app/api/changelog/route.ts)

Same query but no staff filter.

### Why Some Actions Missing?

Possible causes:
1. Recent Activity filters out certain categories
2. Staff ID not being saved correctly for those actions
3. Frontend display logic filtering them out

---

## Part 1: Add Points to Recent Activity

### Files to Modify
- [app/api/staff/dashboard/recent-activity/route.ts](../../app/api/staff/dashboard/recent-activity/route.ts)
- [components/features/staff/ActivityLog.tsx](../../components/features/staff/ActivityLog.tsx) (if exists)
- [app/staff/dashboard/page.tsx](../../app/staff/dashboard/page.tsx)

### Implementation

#### Step 1: Update API to Include Points Data

```typescript
// app/api/staff/dashboard/recent-activity/route.ts

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    }

    const result = await sql`
      SELECT
        c.*,
        sl.nickname,
        sl.full_name,
        -- Extract points from metadata if available
        COALESCE(
          (c.metadata->>'points_earned')::INTEGER,
          (c.metadata->>'points')::INTEGER,
          0
        ) as points_earned
      FROM changelog c
      JOIN staff_list sl ON c.staff_id = sl.id
      WHERE c.staff_id = ${staffId}
      ORDER BY c.created_at DESC
      LIMIT 20;
    `;

    return NextResponse.json({ activities: result.rows });
  } catch (error) {
    console.error('[API] Error fetching recent activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
```

#### Step 2: Update Frontend Display

**In dashboard page.tsx**:

```tsx
{/* Recent Activity */}
<div className="space-y-2">
  {recentActivity.map((activity) => (
    <div key={activity.id} className="flex items-start gap-3 p-3 border rounded">
      {/* Activity icon */}
      <div className="mt-1">
        {getActivityIcon(activity.category)}
      </div>

      {/* Activity details */}
      <div className="flex-1">
        <p className="text-sm font-medium">
          {formatActivityTitle(activity)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(activity.created_at))} ago
        </p>
      </div>

      {/* Points earned (NEW) */}
      {activity.points_earned > 0 && (
        <div className="flex items-center gap-1 text-sm font-medium text-yellow-600">
          <Star className="h-4 w-4 fill-yellow-500" />
          +{activity.points_earned}
        </div>
      )}
    </div>
  ))}
</div>
```

#### Step 3: Helper Functions

```tsx
const getActivityIcon = (category: string) => {
  switch (category) {
    case 'content_check':
      return <ClipboardCheck className="h-4 w-4 text-blue-500" />;
    case 'play_log':
      return <PlayCircle className="h-4 w-4 text-green-500" />;
    case 'knowledge_added':
      return <BookOpen className="h-4 w-4 text-purple-500" />;
    case 'issue_report':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'task':
      return <CheckSquare className="h-4 w-4 text-green-600" />;
    case 'points_config':
      return <Settings className="h-4 w-4 text-gray-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-400" />;
  }
};

const formatActivityTitle = (activity: any) => {
  const metadata = activity.metadata || {};

  switch (activity.category) {
    case 'content_check':
      return `Checked ${metadata.game_name || 'a game'}`;
    case 'play_log':
      return `Played ${metadata.game_name || 'a game'}`;
    case 'knowledge_added':
      return `Learned ${metadata.game_name || 'a game'}`;
    case 'issue_report':
      return `Reported issue: ${metadata.issue_type || 'issue'}`;
    case 'task':
      return `Completed: ${metadata.task_title || 'task'}`;
    case 'points_config':
      return `Points updated`;
    default:
      return activity.action || 'Activity';
  }
};
```

---

## Part 2: Fix Missing Point Action Categories

### Diagnosis Steps

#### Step 1: Check Changelog Entries

```sql
-- Check if these entries exist in changelog table
SELECT
  id,
  category,
  action,
  staff_id,
  metadata,
  created_at
FROM changelog
WHERE category IN ('issue_report', 'points_config', 'task')
ORDER BY created_at DESC
LIMIT 20;
```

#### Step 2: Verify Staff ID Association

```sql
-- Check if staff_id is set for these categories
SELECT
  category,
  COUNT(*) as total,
  COUNT(staff_id) as with_staff_id
FROM changelog
WHERE category IN ('issue_report', 'points_config', 'task')
GROUP BY category;
```

### Fix Implementation

#### Option A: Staff ID Missing (Most Likely)

If staff_id is NULL for these categories, update the code that creates these changelog entries.

**Files to check:**
- [lib/services/vikunja-service.ts](../../lib/services/vikunja-service.ts) - Task completion
- [app/api/vikunja/tasks/complete/route.ts](../../app/api/vikunja/tasks/complete/route.ts) - Task completion endpoint
- [components/features/issues/IssueReportDialog.tsx](../../components/features/issues/IssueReportDialog.tsx) - Issue reporting

**Fix pattern:**

```typescript
// When creating changelog entry for task completion
await ChangelogService.createEntry({
  staff_id: staffId, // ⚠️ Make sure this is set!
  category: 'task',
  action: 'completed_task',
  metadata: {
    task_id: taskId,
    task_title: taskTitle,
    points_earned: points,
  },
});
```

#### Option B: Frontend Filtering Out

If entries exist but don't display, check frontend filters:

```tsx
// Check if there's filtering logic like this:
const displayedActivities = recentActivity.filter(
  (a) => ['content_check', 'play_log', 'knowledge_added'].includes(a.category)
);
// ⚠️ Remove this filter or add missing categories
```

### Implementation: Add Missing Staff IDs

**For Task Completion** ([app/api/vikunja/tasks/complete/route.ts](../../app/api/vikunja/tasks/complete/route.ts)):

```typescript
// After awarding points
await ChangelogService.createEntry({
  staff_id: staff.id, // Add this
  category: 'task',
  action: 'completed_task',
  metadata: {
    task_id: taskId,
    task_title: taskTitle,
    points_earned: points,
    game_id: gameId,
  },
});
```

**For Issue Reporting** (New IssueReportDialog):

```typescript
// When creating Vikunja task
await ChangelogService.createEntry({
  staff_id: localStorage.getItem('staff_id'), // Add this
  category: 'issue_report',
  action: 'reported_issue',
  metadata: {
    issue_type: selectedIssue.label,
    game_id: gameId,
    game_name: gameName,
    vikunja_task_id: createdTask.id,
  },
});
```

---

## Implementation Steps

### Step 1: Update Recent Activity API
1. Open [app/api/staff/dashboard/recent-activity/route.ts](../../app/api/staff/dashboard/recent-activity/route.ts)
2. Add points_earned extraction from metadata
3. Include nickname in response
4. Test API response

### Step 2: Diagnose Missing Categories
1. Run SQL queries to check changelog entries
2. Identify if staff_id is missing
3. Locate where these entries are created

### Step 3: Fix Missing Staff IDs
1. Update task completion endpoint to include staff_id
2. Update issue reporting to include staff_id
3. Update points config changes to include staff_id
4. Test that new entries are created correctly

### Step 4: Update Dashboard Display
1. Open [app/staff/dashboard/page.tsx](../../app/staff/dashboard/page.tsx)
2. Add points display to activity items
3. Add icons for all categories
4. Implement formatActivityTitle helper
5. Test display with various activity types

### Step 5: Test End-to-End
1. Complete a task → verify appears in Recent Activity with points
2. Report an issue → verify appears in Recent Activity
3. Update points → verify appears in Recent Activity
4. Do content check → verify appears with points (if awarded)
5. Verify nicknames display correctly

### Step 6: Commit and Deploy
```bash
git add .
git commit -m "v1.5.6 - Fix dashboard Recent Activity

- Add points earned display to activity items
- Fix missing point action categories (task, issue report, points config)
- Ensure staff_id is set for all changelog entries
- Use nicknames for staff names

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

### Points Display
- [ ] Recent Activity API returns points_earned
- [ ] Points display next to activity items
- [ ] Star icon shows for activities with points
- [ ] Zero points don't display "+0"

### Missing Categories
- [ ] Task completion appears in Recent Activity
- [ ] Issue reports appear in Recent Activity
- [ ] Points config changes appear in Recent Activity
- [ ] All have correct icons
- [ ] All have formatted titles

### Staff Names
- [ ] Nicknames display (not full names)
- [ ] Names display correctly for all activity types

---

## Rollback Plan

If issues arise:
1. Revert API changes
2. Revert frontend display changes
3. Check changelog table for corruption
4. Restore from backup if needed

---

## Estimated Timeline

- **Diagnosis**: 15 minutes
- **API Updates**: 15 minutes
- **Fix Staff IDs**: 20 minutes
- **Frontend Display**: 20 minutes
- **Testing**: 15 minutes
- **Total**: ~1 hour 25 minutes

---

## Related Files

### API
- [app/api/staff/dashboard/recent-activity/route.ts](../../app/api/staff/dashboard/recent-activity/route.ts)
- [app/api/vikunja/tasks/complete/route.ts](../../app/api/vikunja/tasks/complete/route.ts)

### Services
- [lib/services/changelog-service.ts](../../lib/services/changelog-service.ts)
- [lib/services/vikunja-service.ts](../../lib/services/vikunja-service.ts)

### Components
- [app/staff/dashboard/page.tsx](../../app/staff/dashboard/page.tsx)
- [components/features/issues/IssueReportDialog.tsx](../../components/features/issues/IssueReportDialog.tsx) (Phase 3)

---

## Notes

- Points are stored in changelog metadata as JSON
- Staff ID association is critical for Recent Activity filtering
- Admin Changelog (/staff/changelog) should show all staff activity
- Dashboard Recent Activity should show only logged-in staff's activity
- Consider caching Recent Activity for performance (future enhancement)
