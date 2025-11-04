# Issue Reporting System - Implementation Phases

**Created**: 2025-11-04
**Version**: 1.5.2+
**Status**: In Progress

---

## Overview

Complete implementation of Issue Reporting System with three phases:
1. Phase 1: Quick Fixes (Changelog & Task Category)
2. Phase 2: Points Configuration Dashboard
3. Phase 3: Non-Actionable Issues Workflow

**Label Names**: `task` / `note`
**Page Rename**: "Content Check History" → "BG Issues & Checks"

---

## Phase 1: Quick Fixes (30 minutes)

### Goal
Fix immediate issues with changelog display and task completion categorization.

### Tasks

#### 1.1 Fix Changelog Staff Member Display (15 min)
**Problem**: Activity log shows "Unknown" for staff members because no JOIN with staff_list table

**File**: `app/api/changelog/route.ts`

**Changes**:
```typescript
// OLD:
SELECT * FROM changelog
WHERE ${whereClause}
ORDER BY created_at DESC

// NEW:
SELECT
  c.*,
  s.staff_name,
  s.staff_email
FROM changelog c
LEFT JOIN staff_list s ON c.staff_id = s.id
WHERE ${whereClause}
ORDER BY c.created_at DESC
```

**Expected Result**: Staff names appear in activity log

---

#### 1.2 Add Points Awarded Column to Changelog Display (10 min)
**Problem**: Points are shown as event type, should have dedicated column

**File**: `app/staff/changelog/page.tsx`

**Current Columns**: Date/Time | Event | Category | Description | Staff Member
**New Columns**: Date/Time | Event | Category | Points Awarded | Description | Staff Member

**Changes**:
- Update table header to include "Points Awarded" column
- Display `points_awarded` value (or "—" if null)
- Right-align numbers for better readability

**Expected Result**: Points shown in dedicated column, not as event type

---

#### 1.3 Update Task Completion to Use "task" Category (5 min)
**Problem**: Task completions use "points" category instead of "task"

**File**: `app/api/vikunja/tasks/complete/route.ts`

**Changes**:
```typescript
// OLD:
category: 'points',
event_type: 'points_awarded',

// NEW:
category: 'task',
event_type: 'task_completed',
```

**Expected Result**: Task completions appear with "task" category in changelog

---

### Testing Checklist (Phase 1)
- [ ] Changelog API returns staff_name and staff_email
- [ ] Activity log displays staff names correctly (not "Unknown")
- [ ] Points Awarded column shows correct values
- [ ] Old entries without points show "—" in Points column
- [ ] Task completions show category = "task"
- [ ] Task completions show event_type = "task_completed"

---

## Phase 2: Points Configuration Dashboard (1 hour)

### Goal
Create admin UI to adjust point values for all 9 activity types.

### Tasks

#### 2.1 Create Points Config Database Table (10 min)
**File**: `scripts/create-points-config-table.js`

**Schema**:
```sql
CREATE TABLE points_config (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) UNIQUE NOT NULL,
  base_points INTEGER NOT NULL,
  uses_complexity BOOLEAN DEFAULT false,
  uses_level_multiplier BOOLEAN DEFAULT false,
  uses_student_count BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by_id UUID REFERENCES staff_list(id)
);
```

**Initial Data**:
```sql
INSERT INTO points_config (action_type, base_points, uses_complexity, description) VALUES
  ('play_log', 100, false, 'Points for logging a play session'),
  ('content_check', 1000, true, 'Points for completing content check (× complexity)'),
  ('knowledge_add_level_1', 100, true, 'Beginner level (× complexity)'),
  ('knowledge_add_level_2', 200, true, 'Intermediate level (× complexity)'),
  ('knowledge_add_level_3', 300, true, 'Expert level (× complexity)'),
  ('knowledge_add_level_4', 500, true, 'Instructor level (× complexity)'),
  ('knowledge_upgrade', 100, true, 'Upgrading knowledge level (× complexity)'),
  ('teaching', 1000, true, 'Teaching session (× complexity × students)'),
  ('photo_upload', 1000, false, 'Uploading game photo'),
  ('issue_report', 100, false, 'Reporting any issue'),
  ('issue_resolution_basic', 500, false, 'Resolving basic issue'),
  ('issue_resolution_complex', 1000, false, 'Resolving complex issue (complexity ≥ 3)');
```

---

#### 2.2 Create Points Config API Endpoints (15 min)
**File**: `app/api/admin/points-config/route.ts`

**Endpoints**:
- `GET /api/admin/points-config` - Fetch all point configurations
- `PUT /api/admin/points-config` - Update point value(s)

**Response Format**:
```typescript
{
  success: true,
  config: [
    {
      action_type: 'play_log',
      base_points: 100,
      uses_complexity: false,
      description: 'Points for logging a play session',
      updated_at: '2025-11-04T...'
    },
    // ... more configs
  ]
}
```

---

#### 2.3 Update Points Service to Use Database Config (15 min)
**File**: `lib/services/points-service.ts`

**Changes**:
- Add `loadPointsConfig()` function to fetch from database
- Cache config in memory (refresh every 5 minutes)
- Update `calculatePoints()` to use database values instead of hardcoded
- Keep backward compatibility if database fails

**Example**:
```typescript
let pointsConfigCache: Record<string, PointConfig> = {};
let lastConfigLoad = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadPointsConfig() {
  if (Date.now() - lastConfigLoad < CONFIG_CACHE_TTL) {
    return pointsConfigCache;
  }

  const result = await pool.query('SELECT * FROM points_config');
  pointsConfigCache = result.rows.reduce((acc, row) => {
    acc[row.action_type] = row;
    return acc;
  }, {});
  lastConfigLoad = Date.now();

  return pointsConfigCache;
}
```

---

#### 2.4 Create Admin Points Config UI (20 min)
**File**: `app/admin/points-config/page.tsx`

**Layout**: Simple grid/table with inline editing

**Features**:
- Table showing all point configurations
- Inline number inputs for base_points
- Badges showing modifiers (× Complexity, × Level, × Students)
- Save button per row or bulk save
- Success/error toast notifications
- Description tooltips explaining each action type

**UI Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ Points Configuration Dashboard                              │
├─────────────────────────────────────────────────────────────┤
│ Action Type          | Points | Modifiers    | Description  │
├─────────────────────────────────────────────────────────────┤
│ Play Log             | [100]  |              | Logging play │
│ Content Check        | [1000] | × Complexity | Content chk  │
│ Knowledge Add (L1)   | [100]  | × Complexity | Beginner lvl │
│ Knowledge Add (L2)   | [200]  | × Complexity | Interm. lvl  │
│ ...                                                          │
├─────────────────────────────────────────────────────────────┤
│                                        [Save All Changes]    │
└─────────────────────────────────────────────────────────────┘
```

**Admin Access**: Link from Staff Changelog page (admin-only)

---

### Testing Checklist (Phase 2)
- [ ] Database table created with initial values
- [ ] GET /api/admin/points-config returns all configs
- [ ] PUT /api/admin/points-config updates values
- [ ] Points service loads config from database
- [ ] Config cache refreshes every 5 minutes
- [ ] Admin UI displays all point configurations
- [ ] Inline editing updates values successfully
- [ ] Changes reflect in point awards immediately
- [ ] Non-admin users cannot access page

---

## Phase 3: Non-Actionable Issues Workflow (2.5 hours)

### Goal
Complete workflow for non-actionable issues: create Vikunja tasks, display in "BG Issues & Checks", and resolve from there.

### Label Names
- Actionable: `task`
- Non-Actionable: `note`

### Page Rename
**Old**: "Content Check History"
**New**: "BG Issues & Checks"

---

### Tasks

#### 3.1 Create Vikunja Labels (5 min)
**Script**: `scripts/create-issue-type-labels.js`

**Labels to Create**:
```javascript
[
  {
    title: 'task',
    hex_color: '#ff6b6b', // Red - requires action
    description: 'Issue requires staff action to resolve'
  },
  {
    title: 'note',
    hex_color: '#4dabf7', // Blue - informational
    description: 'Issue logged for tracking, no immediate action needed'
  }
]
```

**API**: `POST /api/v1/labels` (Board Game Issues project)

---

#### 3.2 Update Vikunja Service to Handle Both Types (20 min)
**File**: `lib/services/vikunja-service.ts`

**Changes**:
- Add `issueType: 'task' | 'note'` parameter to `createBoardGameIssueTask()`
- Apply appropriate label based on issueType
- Update task title format to indicate type
- Add priority: high for 'task', normal for 'note'

**Example**:
```typescript
export async function createBoardGameIssueTask(params: {
  // ... existing params
  issueType: 'task' | 'note'; // NEW
}): Promise<number> {
  const { issueType, gameName, issueCategory, ... } = params;

  // Get label ID based on type
  const labelId = await getIssueLabelId(issueType);

  const taskData = {
    title: `[${issueType.toUpperCase()}] ${gameName} - ${issueCategoryDisplay}`,
    description: ...,
    project_id: VIKUNJA_BG_ISSUES_PROJECT_ID,
    labels: [labelId],
    priority: issueType === 'task' ? 3 : 1, // High for tasks, normal for notes
    // ...
  };

  // ...
}
```

---

#### 3.3 Update Report Issue Endpoint (10 min)
**File**: `app/api/games/[id]/report-issue/route.ts`

**Changes**:
- Create Vikunja task for BOTH actionable AND non-actionable
- Pass `issueType` to `createBoardGameIssueTask()`
- Award 100 points for reporting (both types)
- Store `vikunja_task_id` in game_issues table (both types)

**Code Change**:
```typescript
// OLD:
if (issueType === 'actionable') {
  vikunjaTaskId = await createBoardGameIssueTask({...});
}

// NEW:
vikunjaTaskId = await createBoardGameIssueTask({
  gameName: game.name,
  gameId: gameId,
  gameComplexity: game.complexity,
  issueCategory: body.issueCategory,
  issueDescription: body.issueDescription,
  reportedBy: reporter.staff_name,
  reportedByVikunjaUserId: reporter.vikunja_user_id,
  issueType: issueType === 'actionable' ? 'task' : 'note' // NEW
});
```

---

#### 3.4 Create Non-Actionable Issues API Endpoint (30 min)
**File**: `app/api/issues/non-actionable/route.ts`

**Endpoint**: `GET /api/issues/non-actionable`

**Query**: Fetch unresolved non-actionable issues with game and reporter info
```sql
SELECT
  gi.*,
  g.name as game_name,
  g.complexity,
  g.image_url,
  s.staff_name as reported_by_name,
  resolver.staff_name as resolved_by_name
FROM game_issues gi
LEFT JOIN games g ON gi.game_id = g.id
LEFT JOIN staff_list s ON gi.reported_by_id = s.id
LEFT JOIN staff_list resolver ON gi.resolved_by_id = resolver.id
WHERE gi.issue_type = 'non_actionable'
  AND gi.resolved_at IS NULL
ORDER BY gi.created_at DESC
```

**Response Format**:
```typescript
{
  success: true,
  issues: [
    {
      id: 'issue_xxx',
      game_id: 'xxx',
      game_name: 'Catan',
      complexity: 2,
      image_url: 'https://...',
      issue_category: 'missing_pieces',
      description: 'Missing 2 red settlements',
      reported_by_name: 'John Doe',
      vikunja_task_id: 123,
      created_at: '2025-11-04T...'
    },
    // ...
  ]
}
```

---

#### 3.5 Create Issues Database Service (20 min)
**File**: `lib/services/issues-db-service.ts`

**Functions**:
```typescript
export async function getNonActionableIssues(): Promise<GameIssue[]>
export async function resolveIssue(
  issueId: string,
  resolvedById: string
): Promise<boolean>
export async function getIssueById(issueId: string): Promise<GameIssue | null>
```

**Implementation**:
- Use connection pool from `lib/db/postgres.ts`
- Include proper error handling
- Log operations for debugging
- Return enriched data (game info, staff names)

---

#### 3.6 Update BG Issues & Checks Component (45 min)
**File**: `components/features/content-check/IssuesMissingReport.tsx`

**Changes**:
1. **Rename Component**: `IssuesMissingReport` → `BGIssuesAndChecks`
2. **Update API Endpoint**: `/api/content-checks/needs-attention` → `/api/issues/non-actionable`
3. **Update Display**:
   - Show issue category badge
   - Show reporter name
   - Show days since reported
   - Add "Resolve" button per issue
4. **Add Resolve Workflow**:
   - Dialog to confirm resolution
   - Call `/api/issues/[id]/resolve` endpoint
   - Update Vikunja task status
   - Refresh list after resolution
   - NO points awarded (resolved by admin)

**UI Structure**:
```
┌──────────────────────────────────────────────────────────┐
│ BG Issues & Checks                                       │
├──────────────────────────────────────────────────────────┤
│ Non-Actionable Issues (3)                                │
├──────────────────────────────────────────────────────────┤
│ [Image] Catan                                            │
│         Category: Missing Pieces                         │
│         Description: Missing 2 red settlements           │
│         Reported by: John Doe (3 days ago)               │
│         [Resolve Issue]                                  │
├──────────────────────────────────────────────────────────┤
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
```

---

#### 3.7 Update Staff Dashboard to Filter Out Non-Actionable (15 min)
**File**: `app/staff/dashboard/page.tsx`

**Changes**:
- Fetch tasks from Vikunja API
- Filter out tasks with "note" label
- Only show tasks with "task" label in "Board Game Issues" section
- Keep existing due date filtering (3 days)

**Filter Logic**:
```typescript
const actionableTasks = allTasks.filter(task => {
  const hasTaskLabel = task.labels?.some(label => label.title === 'task');
  const hasNoteLabel = task.labels?.some(label => label.title === 'note');
  return hasTaskLabel && !hasNoteLabel;
});
```

---

#### 3.8 Rename Navigation and Page References (10 min)
**Files to Update**:
- `app/staff/check-history/page.tsx` - Update page title
- `components/features/staff/StaffMenu.tsx` - Update nav link text
- Any breadcrumbs or references to "Content Check History"

**Changes**:
- "Content Check History" → "BG Issues & Checks"
- Update route if necessary (optional: keep `/staff/check-history` for backward compat)

---

#### 3.9 Create Resolve Issue API Endpoint (15 min)
**File**: `app/api/issues/[id]/resolve/route.ts`

**Endpoint**: `POST /api/issues/[id]/resolve`

**Body**:
```typescript
{
  resolvedById: string; // Staff UUID
}
```

**Actions**:
1. Update `game_issues` table:
   - Set `resolved_at = NOW()`
   - Set `resolved_by_id = resolvedById`
2. Update Vikunja task:
   - Mark task as done
   - Add comment: "Resolved by [staff_name]"
3. NO points awarded (admin resolution)
4. Log to changelog (optional)

**Response**:
```typescript
{
  success: true,
  issue: { /* updated issue */ }
}
```

---

#### 3.10 Retroactive Label Assignment Script (10 min)
**Script**: `scripts/label-existing-issues.js`

**Purpose**: Add "note" label to existing non-actionable issues in Vikunja

**Logic**:
1. Fetch all non-actionable issues from `game_issues` table
2. For each issue with `vikunja_task_id`:
   - Fetch task from Vikunja API
   - Check if "note" label exists
   - Add "note" label if missing
3. Log results

---

### Testing Checklist (Phase 3)
- [ ] Vikunja labels created ("task" red, "note" blue)
- [ ] Actionable issues create tasks with "task" label
- [ ] Non-actionable issues create tasks with "note" label
- [ ] GET /api/issues/non-actionable returns correct issues
- [ ] BG Issues & Checks page displays non-actionable issues
- [ ] Issue cards show all required info (category, reporter, days)
- [ ] Resolve button opens confirmation dialog
- [ ] POST /api/issues/[id]/resolve marks issue resolved
- [ ] Vikunja task marked as done on resolution
- [ ] NO points awarded for non-actionable resolution
- [ ] Staff Dashboard ONLY shows "task" labeled issues
- [ ] Staff Dashboard does NOT show "note" labeled issues
- [ ] Navigation menu shows "BG Issues & Checks"
- [ ] Page title updated everywhere
- [ ] Retroactive script labels existing issues
- [ ] Complete workflow: Report → Create Task → Display → Resolve

---

## Success Criteria

### Phase 1 Success
- ✅ Changelog shows staff names (no "Unknown")
- ✅ Points Awarded column displays correctly
- ✅ Task completions use "task" category

### Phase 2 Success
- ✅ Admin can view all point configurations
- ✅ Admin can edit point values inline
- ✅ Changes persist to database
- ✅ Points service uses database values
- ✅ Point awards reflect updated config

### Phase 3 Success
- ✅ Both issue types create Vikunja tasks
- ✅ Tasks labeled correctly ("task" / "note")
- ✅ Non-actionable issues display in BG Issues & Checks
- ✅ Staff Dashboard only shows actionable ("task") issues
- ✅ Admin can resolve non-actionable issues
- ✅ Resolution updates both database and Vikunja
- ✅ No points awarded for non-actionable resolution
- ✅ Page renamed throughout application

---

## Version Tracking

- **Phase 1**: v1.5.2
- **Phase 2**: v1.5.3
- **Phase 3**: v1.5.4

Update [lib/version.ts](../lib/version.ts) and [package.json](../package.json) after each phase completion.

---

## Related Files

### Core Services
- [lib/services/points-service.ts](../lib/services/points-service.ts)
- [lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts)
- [lib/services/changelog-service.ts](../lib/services/changelog-service.ts)
- [lib/services/issues-db-service.ts](../lib/services/issues-db-service.ts) (NEW)

### API Endpoints
- [app/api/changelog/route.ts](../app/api/changelog/route.ts)
- [app/api/vikunja/tasks/complete/route.ts](../app/api/vikunja/tasks/complete/route.ts)
- [app/api/admin/points-config/route.ts](../app/api/admin/points-config/route.ts) (NEW)
- [app/api/issues/non-actionable/route.ts](../app/api/issues/non-actionable/route.ts) (NEW)
- [app/api/issues/[id]/resolve/route.ts](../app/api/issues/[id]/resolve/route.ts) (NEW)

### UI Components
- [app/staff/changelog/page.tsx](../app/staff/changelog/page.tsx)
- [app/staff/dashboard/page.tsx](../app/staff/dashboard/page.tsx)
- [app/admin/points-config/page.tsx](../app/admin/points-config/page.tsx) (NEW)
- [components/features/content-check/BGIssuesAndChecks.tsx](../components/features/content-check/BGIssuesAndChecks.tsx) (RENAMED)

### Scripts
- [scripts/create-points-config-table.js](../scripts/create-points-config-table.js) (NEW)
- [scripts/create-issue-type-labels.js](../scripts/create-issue-type-labels.js) (NEW)
- [scripts/label-existing-issues.js](../scripts/label-existing-issues.js) (NEW)

---

**End of Document**
