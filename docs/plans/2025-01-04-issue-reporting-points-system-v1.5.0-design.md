# Issue Reporting & Points System v1.5.0 - Design Document

**Date**: January 4, 2025
**Version**: 1.5.0
**Status**: Approved for Implementation
**Author**: Claude Code (with Brendon)

---

## Executive Summary

This design transforms the current content check issue reporting system into a structured workflow with pre-defined issue categories, automated Vikunja task creation, and a centralized points award system across 7 activity types.

**Key Changes**:
- Replace manual "Report an Issue" toggle with pre-defined issue categories
- Automatically create Vikunja tasks for actionable issues
- Award points via centralized service for 7 activity types
- Separate actionable issues (tasks) from non-actionable issues (tracking)
- Autonomous Playwright testing on staging with auto bug fixes

**Goals**:
1. Eliminate staff confusion about actionable vs non-actionable issues
2. Automate task creation for game maintenance
3. Centralize all point calculations in one service
4. Maintain zero performance impact for users
5. Enable complete autonomous testing

---

## Problem Statement

### Current Issues (v1.4.x)

1. **Staff Confusion**: Staff must decide "Is this actionable?" causing inconsistency
2. **"Games Needing Attention" Clutter**: All issues appear here, even unfixable ones (missing pieces)
3. **Manual Task Creation**: Staff must manually create Vikunja tasks for maintenance
4. **Scattered Point Awards**: Point logic scattered across codebase, inconsistent
5. **Manual Testing**: Time-consuming manual testing on staging

### User Story

> "As a staff member, when I notice a game needs re-sleeving, I want to quickly report it so a task is automatically created in Vikunja with the correct points and due date, without having to decide if it's 'actionable' or manually create the task myself."

---

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│ STAFF ACTION (User clicks 📋 on game card)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ ContentCheckOrIssueDialog                                   │
│ • Perform Full Content Check                                │
│ • Report an Issue                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ Full Content Check       │  │ IssueReportDialog        │
│ (Existing workflow)      │  │ (NEW - Pre-defined types)│
└──────────────────────────┘  └──────────────────────────┘
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                   ┌──────────────────┐   ┌──────────────────┐
                   │ Actionable Issue │   │ Non-Actionable   │
                   │ (Creates Task)   │   │ (Just Logs)      │
                   └──────────────────┘   └──────────────────┘
                              │                       │
                              ▼                       ▼
                   ┌──────────────────┐   ┌──────────────────┐
                   │ Vikunja Task     │   │ game_issues DB   │
                   │ (BG Issues proj) │   │ (tracking only)  │
                   └──────────────────┘   └──────────────────┘
                              │                       │
                              ▼                       ▼
                   ┌──────────────────┐   ┌──────────────────┐
                   │ Staff Dashboard  │   │ Issues Overview  │
                   │ (Actionable)     │   │ (Non-actionable) │
                   └──────────────────┘   └──────────────────┘
```

### Core Design Principles

1. **Centralized Points Service** - Single source of truth for all point calculations
2. **Async Non-Blocking** - Point awards never slow down user actions (~0ms impact)
3. **Pre-defined Categories** - Staff select from list, system routes automatically
4. **Fail-Safe** - Point failures logged but don't affect main operations
5. **Auditable** - All point awards logged to changelog table

---

## Database Schema

### New Table: `game_issues`

```sql
CREATE TABLE game_issues (
  id VARCHAR(50) PRIMARY KEY,
  game_id VARCHAR(50) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  reported_by_id UUID NOT NULL REFERENCES staff_list(id),
  issue_category VARCHAR(50) NOT NULL,
  issue_type VARCHAR(20) NOT NULL, -- 'actionable' or 'non_actionable'
  description TEXT,
  vikunja_task_id INTEGER, -- NULL for non-actionable
  resolved_at TIMESTAMP,
  resolved_by_id UUID REFERENCES staff_list(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_game_issues_game_id ON game_issues(game_id);
CREATE INDEX idx_game_issues_category ON game_issues(issue_category);
CREATE INDEX idx_game_issues_unresolved
  ON game_issues(issue_type) WHERE resolved_at IS NULL;
CREATE INDEX idx_game_issues_vikunja
  ON game_issues(vikunja_task_id) WHERE vikunja_task_id IS NOT NULL;
```

**Issue Categories**:

**Actionable** (Creates Vikunja task):
- `broken_sleeves` - 500 points base
- `needs_sorting` - 500 points base
- `needs_cleaning` - 500 points base
- `box_rewrap` - 1000 points (always)
- `customer_reported` - Triggers content check (0 points)
- `other_actionable` - 500 points base (requires confirmation)

**Non-Actionable** (Just logs):
- `missing_pieces` - No task, just tracking
- `broken_components` - No task, needs ordering
- `damaged_box` - No task, cosmetic only
- `component_wear` - No task, documentation

**Points Multiplier**: If game complexity ≥ 3, multiply resolution points by 2

### Updated Table: `changelog`

```sql
ALTER TABLE changelog
ADD COLUMN points_awarded INTEGER DEFAULT 0,
ADD COLUMN point_category VARCHAR(50);
```

**Point Categories**:
- `play_log`
- `content_check`
- `knowledge_add`
- `knowledge_upgrade`
- `teaching`
- `photo_upload`
- `issue_report`
- `issue_resolution`

---

## Points Service Architecture

### PointsService Class

**Location**: `lib/services/points-service.ts`

**Core Methods**:

```typescript
class PointsService {
  // Calculate points based on action type
  static calculatePoints(params: {
    actionType: string;
    metadata: {
      gameComplexity?: number;
      knowledgeLevel?: number;
      studentCount?: number;
      issueCategory?: string;
    };
  }): number;

  // Award points (async, non-blocking)
  static async awardPoints(params: {
    staffId: string;
    actionType: string;
    metadata: any;
    context?: string;
  }): Promise<PointAwardResult>;

  // Log to changelog
  private static async logPointAward(
    params: PointAwardParams,
    points: number
  ): Promise<string>;
}
```

### Point Calculation Formulas

| Action Type | Formula | Example |
|-------------|---------|---------|
| **Play Log** | 100 points | Always 100 |
| **Content Check** | 1000 × complexity | Complexity 3 = 3000 points |
| **Knowledge Add** | level_multiplier × complexity | Expert (300) × 3 = 900 points |
| **Knowledge Upgrade** | 100 × complexity | Complexity 2 = 200 points |
| **Teaching** | 1000 × complexity × students | 3 complexity × 2 students = 6000 points |
| **Photo Upload** | 1000 points | Always 1000 |
| **Issue Report** | 100 points | Reporter bonus (all issues) |
| **Issue Resolution** | base × multiplier | 500 base × 2 (if complexity ≥ 3) = 1000 |

**Knowledge Level Multipliers**:
- Beginner (1): 100
- Intermediate (2): 200
- Expert (3): 300
- Instructor (4): 500

**Issue Resolution Base Points**:
- `broken_sleeves`: 500
- `needs_sorting`: 500
- `needs_cleaning`: 500
- `box_rewrap`: 1000
- `other_actionable`: 500

### Async Point Award Pattern

```typescript
// In service layer (e.g., play-logs-db-service.ts)
async createLog(data: PlayLogData) {
  // Main operation (blocks)
  const log = await db.insert(play_logs).values(data).returning();

  // Award points (non-blocking, fire-and-forget)
  PointsService.awardPoints({
    staffId: data.staff_id,
    actionType: 'play_log',
    metadata: {},
    context: `Play log for game ${data.game_id}`
  }).catch(err => {
    logger.error('Point award failed:', err);
    // Main operation succeeded, just log error
  });

  return log; // Returns immediately
}
```

**Performance**: User experiences ~0ms delay (point award happens in background)

---

## Vikunja Integration

### New Project: "Board Game Issues"

**Setup**:
1. Create project via Vikunja UI or API
2. Parent: "Sip n Play" (project ID 1)
3. New project ID: likely 3
4. Environment variable: `VIKUNJA_BG_ISSUES_PROJECT_ID=3`

### Task Creation Logic

**When actionable issue reported**:

```typescript
const task = {
  title: `${issueCategory} - ${gameName}`,
  description: `
    Issue: ${description}
    Reported by: ${staffName}
    Game ID: ${gameId}
    Complexity: ${complexity}

    Complete this task to earn ${points} points!
  `,
  dueDate: calculateDueDate(issueCategory), // 1-7 days
  priority: calculatePriority(issueCategory), // 2-5
  labels: [`points:${points}`],
  assignees: [reporterVikunjaUserId] // Auto-assign reporter
};
```

**Due Date Calculation**:
- `customer_reported`: 1 day (urgent)
- `needs_cleaning`: 2 days
- `needs_sorting`: 3 days
- `other_actionable`: 3 days
- `broken_sleeves`: 7 days
- `box_rewrap`: 7 days

**Priority Calculation** (1-5, 5 = highest):
- `customer_reported`: 5
- `needs_cleaning`: 4
- `broken_sleeves`: 3
- `needs_sorting`: 3
- `other_actionable`: 3
- `box_rewrap`: 2

### Task Completion Flow

```
1. Staff clicks "Complete Task" in dashboard
   ↓
2. POST /api/vikunja/tasks/complete-board-game-issue
   { taskId, staffId }
   ↓
3. Get issue from game_issues (via vikunja_task_id)
   ↓
4. Get game details (for complexity)
   ↓
5. Complete task in Vikunja API
   ↓
6. Mark issue resolved in database
   ↓
7. Award points for resolution
   ↓
8. Return { success, pointsAwarded, newTotalPoints }
```

---

## API Endpoints

### Issue Management

**POST /api/game-issues/create**
```typescript
Request: {
  gameId: string;
  reportedById: string;
  issueCategory: string;
  description: string;
}

Response: {
  success: boolean;
  issue: GameIssue;
  vikunjaTaskId?: number; // Only for actionable
  reporterPoints: number; // Always +100
}
```

**GET /api/game-issues/[gameId]**
```typescript
Response: {
  issues: GameIssue[];
  actionableCount: number;
  nonActionableCount: number;
}
```

**GET /api/game-issues/non-actionable**
```typescript
Response: {
  issues: Array<{
    issue: GameIssue;
    game: Game;
    reporter: StaffMember;
  }>;
  totalCount: number;
}
```

**POST /api/game-issues/[id]/resolve**
```typescript
Request: {
  resolvedById: string;
  notes?: string;
}

Response: {
  success: boolean;
  issue: GameIssue;
}
```

### Vikunja Integration

**GET /api/vikunja/tasks/board-game-issues**
```typescript
Response: {
  tasks: TaskWithPoints[];
  count: number;
  totalPoints: number;
}
```

**POST /api/vikunja/tasks/complete-board-game-issue**
```typescript
Request: {
  taskId: number;
  staffId: string;
}

Response: {
  success: boolean;
  issue: GameIssue;
  pointsAwarded: number;
  newTotalPoints: number;
}
```

### Points Management

**GET /api/staff/[id]/points-breakdown**
```typescript
Response: {
  totalPoints: number;
  breakdown: {
    play_logs: { count: number; points: number };
    content_checks: { count: number; points: number };
    knowledge_adds: { count: number; points: number };
    teachings: { count: number; points: number };
    photos: { count: number; points: number };
    issue_reports: { count: number; points: number };
    issue_resolutions: { count: number; points: number };
  };
  recentAwards: ChangelogEntry[];
}
```

---

## Frontend Components

### 1. GameCard Update

**Location**: `components/features/games/GameCard.tsx`

**Change**: Add 📋 emoji button overlay
- Position: Centered between content check and play log icons
- Staff mode only
- Opens `ContentCheckOrIssueDialog`

### 2. ContentCheckOrIssueDialog (NEW)

**Location**: `components/features/content-check/ContentCheckOrIssueDialog.tsx`

**Features**:
- Two large buttons: "Perform Full Content Check" and "Report an Issue"
- Routes to existing ContentCheckDialog or new IssueReportDialog
- Simple, clear UX for decision

### 3. IssueReportDialog (NEW)

**Location**: `components/features/content-check/IssueReportDialog.tsx`

**Features**:
- Radio buttons for 10 issue types (4 actionable + 6 non-actionable/other)
- Grouped by type (Actionable vs Non-Actionable)
- Required notes for: missing_pieces, broken_components, customer_reported, other_issue
- Optional notes for all others
- "Other Issue" confirmation prompt: "Can staff fix this?"
  - Yes → Routes as actionable
  - No → Alert to select non-actionable type
- Validation before submission
- Loading state during task creation
- Success message shows points awarded

### 4. Staff Dashboard Update

**Location**: `app/staff/dashboard/page.tsx`

**Changes**:
- Rename "Games Needing Attention" → "Board Game Issues"
- Fetch from `/api/vikunja/tasks/board-game-issues` (not content checks)
- Display Vikunja tasks with:
  - Game name + issue category
  - Reported by + date
  - Points badge
  - "Complete Task" button
- 3-tier color coding (red/orange/blue for due dates)
- Real-time point update in header after completion

### 5. Issues Overview Page (NEW)

**Location**: `app/staff/issues/page.tsx`

**Features**:
- Table view of all non-actionable issues
- Filterable by category: All, Missing Pieces, Broken Components, Damaged Box, Component Wear
- Each row shows:
  - Game name
  - Issue category
  - Description
  - Reported by + date
  - "Mark Resolved" button
- Export to CSV option (future enhancement)

### 6. Games Gallery Filter

**Location**: `app/games/page.tsx`

**Changes**:
- Add "Has Issues" checkbox filter
- Query games with unresolved issues from `game_issues` table
- Display issue note in game card:
  - Red outline
  - Issue text replaces categories
  - "(Reported by [name])" text

---

## Testing Strategy

### Autonomous Playwright Testing on Staging

**Approach**: Completely unsupervised testing with automatic bug fixes

**Test Suite**: 7 tests (one per point creation endpoint)

#### Test 1: Play Log Points
```
1. Navigate to staging URL
2. Log in as test staff member
3. Get initial point count
4. Open game detail modal
5. Create play log
6. Verify points increased by 100
7. Verify changelog entry created
8. If fails → Debug, fix, commit, push, wait, retry
```

#### Test 2: Content Check Points
```
1. Open game with complexity = 2
2. Get initial point count
3. Perform full content check (Perfect Condition)
4. Verify points increased by 2000
5. Verify changelog entry
6. If fails → Debug, fix, commit, push, wait, retry
```

#### Test 3: Knowledge Add Points
```
1. Navigate to Add Knowledge page
2. Get initial point count
3. Add Expert (3) for complexity 3 game
4. Verify points increased by 900
5. Verify changelog entry
6. If fails → Debug, fix, commit, push, wait, retry
```

#### Test 4: Teaching Points
```
1. Add knowledge with taught_by = another staff UUID
2. Verify teacher points increased by 3000
3. Verify changelog entry
4. If fails → Debug, fix, commit, push, wait, retry
```

#### Test 5: Photo Upload Points
```
1. Upload photo for game
2. Verify points increased by 1000
3. Verify changelog entry
4. If fails → Debug, fix, commit, push, wait, retry
```

#### Test 6: Issue Report Points
```
1. Click 📋 button
2. Select "Report an Issue"
3. Choose "Broken sleeves"
4. Submit
5. Verify +100 points
6. Verify Vikunja task created
7. Verify changelog entry
8. If fails → Debug, fix, commit, push, wait, retry
```

#### Test 7: Issue Resolution Points
```
1. Navigate to Staff Dashboard
2. Find task in "Board Game Issues"
3. Click "Complete Task"
4. Verify points awarded (500-1000)
5. Verify issue resolved
6. Verify changelog entry
7. If fails → Debug, fix, commit, push, wait, retry
```

### Railway Deployment Handling

**Automatic Waiting**:
```
After git push to staging:
1. Wait 10 seconds (build start)
2. Poll /api/health every 30 seconds
3. Check for 200 OK response
4. Timeout after 10 minutes → Log error, retry once
5. When healthy → Continue testing
6. NEVER ask user for confirmation
```

### Bug Fix Loop

**Autonomous Debugging**:
```
When test fails:
1. Capture diagnostics:
   - Playwright screenshot
   - Console logs
   - Network logs
   - Database state (via API)
2. Analyze root cause:
   - Service error?
   - Database error?
   - API error?
   - Frontend error?
3. Implement fix
4. Verify locally (npm run build)
5. Commit with descriptive message
6. Push to staging
7. Wait for deployment
8. Re-run failed test
9. If still fails → Repeat
10. If passes → Next test
```

**Never Stop Until**: All 7 tests pass + performance verified (<200ms)

---

## Performance Considerations

### Point Award Performance

**Impact**: ~0ms (user perspective)

**Why**:
- Point awards are async (fire-and-forget)
- Main operation completes immediately
- Points updated in background
- User never waits

**Database**:
- Atomic increment: `UPDATE staff_list SET points = points + $1 WHERE id = $2`
- Takes ~5-15ms on Railway PostgreSQL
- No race conditions (atomic operation)

**Error Handling**:
- Point failures logged but don't throw
- Main operations (play log, content check, etc.) always succeed
- Can retry failed awards via admin tool

### API Response Times

**Targets**:
- GET requests: <100ms
- POST requests: <200ms
- Background jobs: <1s

**Optimization**:
- Database connection pooling (existing)
- Indexed queries (game_issues indexes)
- Async point awards (no blocking)
- Efficient Vikunja API calls

---

## Migration Plan

### Phase 1: Database (Day 1)
1. Run `scripts/create-game-issues-table.js`
2. Run `scripts/add-points-tracking-to-changelog.js`
3. Create Vikunja "Board Game Issues" project
4. Set `VIKUNJA_BG_ISSUES_PROJECT_ID` environment variable

### Phase 2: Backend Services (Day 2-3)
1. Implement `lib/services/points-service.ts`
2. Implement `lib/services/issues-db-service.ts`
3. Update `lib/services/vikunja-service.ts`
4. Update existing services with point awards

### Phase 3: API Endpoints (Day 3-4)
1. Create 8 new API endpoints
2. Test each endpoint manually
3. Verify database writes

### Phase 4: Frontend (Day 4-6)
1. Update GameCard with 📋 button
2. Create ContentCheckOrIssueDialog
3. Create IssueReportDialog
4. Update Staff Dashboard
5. Create Issues Overview page
6. Add "Has Issues" filter

### Phase 5: Autonomous Testing (Automated)
1. Implement Playwright test suite
2. Implement Railway deployment polling
3. Implement bug fix loop
4. Run until all tests pass

### Phase 6: Production Deployment (Day 7)
1. Create design document
2. Update version to v1.5.0
3. Update CHANGELOG.md
4. Commit to staging
5. Test on staging
6. Wait for user approval
7. Push to main

**Total Timeline**: 7-10 days

---

## Rollback Plan

If critical issues arise in production:

1. **Database**: Keep old `content_checks.has_issue` logic parallel (don't delete)
2. **Points**: Failures don't affect main operations (already fail-safe)
3. **Vikunja**: Add feature flag `DISABLE_AUTO_TASK_CREATION` to .env
4. **Frontend**: Add feature flag `HIDE_ISSUE_BUTTON` to .env

**Emergency Rollback**:
```bash
git revert HEAD
git push origin main
```

Railway will auto-deploy previous version (~2 minutes)

---

## Success Metrics

### Week 1 Post-launch
- 90%+ of issue reports use new flow (not old toggle)
- Zero user-reported slowdowns
- <5% point award failures
- All 7 point categories active

### Month 1
- 100+ Vikunja tasks created automatically
- 50+ tasks completed by staff
- Staff dashboard "Board Game Issues" checked daily
- Reduced "manual task creation" tickets

### Long-term
- Staff confusion eliminated (pre-defined categories)
- Clear actionable task backlog (Vikunja)
- Gamification increases engagement (points system)
- Non-actionable issues tracked systematically

---

## Open Questions & Future Enhancements

### Resolved During Design
- ✅ How to differentiate actionable vs non-actionable? → Pre-defined categories
- ✅ Where to display non-actionable issues? → Issues Overview page + filter
- ✅ How to avoid performance impact? → Async point awards
- ✅ How to test thoroughly? → Autonomous Playwright testing

### Future Enhancements (v1.6.0+)
1. **Points Leaderboard** - Display top staff by points
2. **Badge System** - Award badges for milestones (1000 points, 5000 points, etc.)
3. **Task Templates** - Pre-fill common issues with templates
4. **Bulk Issue Resolution** - Resolve multiple missing pieces at once
5. **Issue Photos** - Attach photos to issue reports
6. **Push Notifications** - Notify staff when assigned to task
7. **Weekly Reports** - Email staff their point breakdown

---

## Appendix

### A. Issue Category Mapping

| Category | Type | Creates Task? | Base Points | Required Note? |
|----------|------|---------------|-------------|----------------|
| broken_sleeves | Actionable | Yes | 500 | No |
| needs_sorting | Actionable | Yes | 500 | No |
| needs_cleaning | Actionable | Yes | 500 | No |
| box_rewrap | Actionable | Yes | 1000 | No |
| customer_reported | Actionable | Yes | 0 | Yes |
| other_actionable | Actionable | Yes | 500 | Yes |
| missing_pieces | Non-Actionable | No | 0 | Yes |
| broken_components | Non-Actionable | No | 0 | Yes |
| damaged_box | Non-Actionable | No | 0 | No |
| component_wear | Non-Actionable | No | 0 | No |

### B. Database Schema Diagram

```
┌─────────────────┐
│ games           │
│ ─────────────── │
│ id (PK)         │◄─────┐
│ name            │      │
│ complexity      │      │
└─────────────────┘      │
                         │
┌─────────────────┐      │
│ staff_list      │      │
│ ─────────────── │      │
│ id (PK)         │◄──┐  │
│ name            │   │  │
│ points          │   │  │
│ vikunja_user_id │   │  │
└─────────────────┘   │  │
         ▲            │  │
         │            │  │
         │            │  │
┌─────────────────┐  │  │
│ game_issues     │  │  │
│ ─────────────── │  │  │
│ id (PK)         │  │  │
│ game_id (FK)    ├──┘  │
│ reported_by (FK)├─────┘
│ issue_category  │
│ issue_type      │
│ description     │
│ vikunja_task_id │
│ resolved_at     │
│ resolved_by (FK)│
└─────────────────┘

┌─────────────────┐
│ changelog       │
│ ─────────────── │
│ id (PK)         │
│ staff_id (FK)   │
│ game_id (FK)    │
│ points_awarded  │◄─── NEW
│ point_category  │◄─── NEW
│ event_type      │
│ description     │
│ created_at      │
└─────────────────┘
```

### C. Point Award Flow Diagram

```
USER ACTION
    │
    ▼
SERVICE LAYER
(play-logs, content-checks, etc.)
    │
    ├─── Main Operation ───► DATABASE (blocks until done)
    │                             │
    │                             ▼
    │                        RETURN TO USER (50-100ms)
    │
    └─── Point Award (async) ──► PointsService.awardPoints()
                                      │
                        ┌─────────────┴─────────────┐
                        ▼                           ▼
                 UPDATE staff_list.points    CREATE changelog entry
                 (atomic increment)          (audit trail)
                        │                           │
                        └─────────────┬─────────────┘
                                      ▼
                                  COMPLETE (background)

User experiences: ~0ms delay
Actual processing: ~20ms in background
```

---

## Conclusion

This design provides a comprehensive solution to issue reporting confusion, manual task creation, and scattered point logic. By centralizing points in one service, pre-defining issue categories, and automating Vikunja task creation, we eliminate staff decision fatigue while maintaining zero performance impact.

The autonomous testing approach ensures thorough validation without manual intervention, and the fail-safe architecture means point failures never affect core operations.

**Ready for Implementation**: All architectural decisions made, all edge cases considered, all components specified.

**Next Step**: Invoke skill to begin Phase 1 implementation.

---

**Document Version**: 1.0
**Last Updated**: January 4, 2025
**Status**: ✅ Approved for Implementation
