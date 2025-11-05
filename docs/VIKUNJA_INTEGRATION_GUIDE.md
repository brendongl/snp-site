# Vikunja Task Creation & Points Integration Guide

**Last Updated**: November 5, 2025
**Current Version**: v1.5.12
**Vikunja Instance**: https://tasks.sipnplay.cafe

---

## Table of Contents
1. [Overview](#overview)
2. [Task Creation Methods](#task-creation-methods)
3. [Points System Architecture](#points-system-architecture)
4. [Integration Workflows](#integration-workflows)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)

---

## Overview

The Sip N Play site integrates with Vikunja task management system to:
- **Create tasks automatically** when staff report board game issues
- **Award points** when staff complete tasks
- **Track activity** in the changelog for audit trails
- **Display tasks** on the staff dashboard

### Key Components
- **Vikunja Service** - [lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts)
- **Points Service** - [lib/services/points-service.ts](../lib/services/points-service.ts)
- **Issues DB Service** - [lib/services/issues-db-service.ts](../lib/services/issues-db-service.ts)

---

## Task Creation Methods

### Method 1: Issue Reporting (Automated)

**When**: Staff report a board game issue via the game detail modal
**How**: POST request to `/api/games/[id]/report-issue`

#### Flow Diagram
```
User clicks "Report Issue" button
    ↓
IssueReportDialog opens
    ↓
User selects issue category + enters description
    ↓
POST /api/games/[id]/report-issue
    ↓
createBoardGameIssueTask() [vikunja-service.ts]
    ↓
Task created in Vikunja (Project 25: Board Game Issues)
    ↓
Issue record created in game_issues table
    ↓
100 point reporter bonus awarded (async)
```

#### Request Format
```typescript
POST /api/games/[gameId]/report-issue
{
  "reportedById": "staff_uuid",
  "issueCategory": "broken_sleeves" | "needs_sorting" | "needs_cleaning" | ...,
  "issueDescription": "Description of the issue",
  "issueType": "task" | "note" // v1.5.3+: Explicit issue type
}
```

#### Task Properties Calculated Automatically
- **Title**: `{category} - {gameName}` (e.g., "broken sleeves - Catan")
- **Due Date**: Calculated based on urgency (1-7 days)
  - `customer_reported`: 1 day (highest priority)
  - `needs_cleaning`: 2 days
  - `needs_sorting`: 3 days
  - `broken_sleeves`: 7 days
  - `box_rewrap`: 7 days
- **Priority**: 1-5 scale (5 = highest)
  - `customer_reported`: 5
  - `needs_cleaning`: 4
  - `broken_sleeves`: 3
  - `needs_sorting`: 3
  - `other_actionable`: 3
- **Points**: Base points × complexity multiplier
  - Base points determined by category (500-1000)
  - Complex games (complexity ≥ 3) get 2× multiplier
- **Assignee**: Reporter (via `vikunja_user_id`)

#### Code Location
[app/api/games/[id]/report-issue/route.ts](../app/api/games/[id]/report-issue/route.ts)

```typescript
// Simplified implementation
const vikunjaTaskId = await createBoardGameIssueTask({
  gameName: game.name,
  gameId: gameId,
  gameComplexity: game.complexity,
  issueCategory: body.issueCategory,
  issueDescription: body.issueDescription,
  reportedBy: reporter.staff_name,
  reportedByVikunjaUserId: reporter.vikunja_user_id,
  issueType: 'task' // or 'note' for non-actionable
});
```

---

### Method 2: Manual Creation via CLI Script

**When**: Admin needs to create a task outside of the normal workflow
**How**: Run `node scripts/add-vikunja-task.js`

#### Features
- Interactive prompts for all task fields
- Support for command-line arguments
- Automatic point label assignment
- Works around Vikunja UI bug (greyed-out "+ Add Task" button)

#### Usage Examples
```bash
# Interactive mode (prompts for all fields)
node scripts/add-vikunja-task.js

# Quick mode with command-line args
node scripts/add-vikunja-task.js --title "Clean popcorn machine" --project 2

# With due date
node scripts/add-vikunja-task.js --title "Inventory audit" --project 8 --due "2025-11-15"
```

#### Available Projects
| ID | Name | Purpose |
|----|------|---------|
| 1 | Inbox | Unprocessed tasks |
| 2 | Sip n Play | General staff tasks |
| 3 | Cleaning | Cleaning-specific tasks |
| 4 | Maintenance | Equipment/facility maintenance |
| 7 | Admin | Administrative tasks |
| 8 | Inventory | Stock management |
| 9 | Events & Marketing | Marketing activities |
| 25 | Board Game Issues | Auto-created from issue reports |

#### Point Label Scale
| Points | ID | Description | Use Case |
|--------|----|----|-----------|
| 100 | 1 | Simple quick task (5-15 min) | Check inventory, water plants |
| 200 | 2 | Minor task (15-30 min) | Clean small area, restock |
| 500 | 3 | Standard task (30-60 min) | Deep clean station, organize |
| 1000 | 4 | Medium effort (1-2 hours) | Full shelf reorganization |
| 2000 | 14 | Complex game multiplier | 1000 × 2 for complexity ≥ 3 |
| 5000 | 5 | Major task (half day) | Deep clean entire floor |
| 10000 | 6 | Large project (full day) | Complete inventory audit |
| 20000 | 7 | Major project (2-3 days) | Store-wide reorganization |
| 50000 | 8 | Epic achievement (1+ week) | Complete overhaul |

#### Code Location
[scripts/add-vikunja-task.js](../scripts/add-vikunja-task.js)

---

### Method 3: Keyboard Shortcut (Vikunja UI)

**When**: Quick task creation without leaving Vikunja
**How**: Press `Ctrl+K` → type "new task"

**⚠️ Known Issue**: The "+ Add Task" button in Vikunja v1.0.0-rc2 is greyed out due to a frontend bug. Use this keyboard shortcut as a workaround.

**See**: [VIKUNJA_WORKAROUNDS.md](../docs/VIKUNJA_WORKAROUNDS.md)

---

## Points System Architecture

### Point Categories

The system tracks 9 types of point-earning activities:

| Action Type | Base Points | Multipliers | Description |
|-------------|-------------|-------------|-------------|
| `play_log` | 100 | None | Logging a game play session |
| `content_check` | 1000 | × complexity | Performing content check |
| `knowledge_add` | 100-500 | × complexity | Adding game expertise |
| `knowledge_upgrade` | 100 | × complexity | Upgrading expertise level |
| `teaching` | 1000 | × complexity × students | Teaching a game |
| `photo_upload` | 1000 | None | Uploading game photos |
| `issue_report` | 100 | None | Reporting a game issue |
| `issue_resolution` | 500-1000 | × 2 if complex | Resolving a game issue |
| `task_complete` | Variable | N/A | Completing a Vikunja task |

### Point Calculation Logic

Points are calculated dynamically using the **Points Service** [lib/services/points-service.ts](../lib/services/points-service.ts):

```typescript
// Simplified example
const points = await calculatePoints({
  actionType: 'content_check',
  metadata: {
    gameComplexity: 3 // From games table
  }
});
// Result: 1000 × 3 = 3000 points
```

### Point Configuration Database

Points configuration is stored in the `points_config` table with 5-minute cache:

```sql
CREATE TABLE points_config (
  action_type TEXT PRIMARY KEY,
  base_points INTEGER NOT NULL,
  uses_complexity BOOLEAN DEFAULT false,
  uses_level_multiplier BOOLEAN DEFAULT false,
  uses_student_count BOOLEAN DEFAULT false,
  description TEXT
);
```

**Admin Interface**: `/admin/points-config` (future feature)

---

## Integration Workflows

### Workflow 1: Issue Report → Task Creation → Points Award

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Staff reports issue via game modal                      │
│    POST /api/games/[id]/report-issue                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API validates input and fetches game details            │
│    - Checks issue category                                  │
│    - Fetches game name, complexity                         │
│    - Fetches reporter Vikunja user ID                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Creates Vikunja task via createBoardGameIssueTask()     │
│    - Calculates points based on category + complexity      │
│    - Sets due date based on urgency                        │
│    - Assigns priority (1-5)                                │
│    - Adds point label and issue type label                 │
│    - Assigns to reporter                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Stores issue in game_issues table                       │
│    - Links to game via game_id                             │
│    - Links to Vikunja task via vikunja_task_id            │
│    - Records reporter, category, description               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Awards 100 point reporter bonus (async)                 │
│    - Calls awardPoints() in points-service                 │
│    - Updates staff_list.points                             │
│    - Logs to changelog table                               │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Files**:
- [app/api/games/[id]/report-issue/route.ts](../app/api/games/[id]/report-issue/route.ts)
- [lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts):329 (`createBoardGameIssueTask`)
- [lib/services/points-service.ts](../lib/services/points-service.ts):199 (`awardPoints`)

---

### Workflow 2: Task Completion → Points Award

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Staff clicks "Complete" button on dashboard task card   │
│    POST /api/vikunja/tasks/complete                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API marks task as complete in Vikunja                   │
│    POST https://tasks.sipnplay.cafe/api/v1/tasks/{id}      │
│    Body: { done: true }                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Awards points using centralized service                 │
│    awardPoints({                                           │
│      staffId: staffId,                                     │
│      actionType: 'task_complete',                          │
│      points: points,  // From task label                   │
│      metadata: { taskId, taskTitle }                       │
│    })                                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Database updates (atomic transaction)                   │
│    - UPDATE staff_list SET points = points + $1            │
│    - INSERT INTO changelog (audit trail)                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Returns updated staff info to client                    │
│    - New total points                                      │
│    - Points awarded this action                            │
│    - Task marked complete                                  │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Files**:
- [app/api/vikunja/tasks/complete/route.ts](../app/api/vikunja/tasks/complete/route.ts)
- [lib/services/points-service.ts](../lib/services/points-service.ts):199 (`awardPoints`)

---

### Workflow 3: Issue Resolution → Task Completion + Points

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Staff clicks "Resolve" on issue (via issues page)       │
│    POST /api/issues/[id]/resolve                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API fetches issue details                               │
│    - Gets issue category                                   │
│    - Gets associated Vikunja task ID                       │
│    - Gets game complexity for point calculation            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Marks Vikunja task as complete                          │
│    completeTask(issue.vikunja_task_id)                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Marks issue as resolved in database                     │
│    UPDATE game_issues SET                                  │
│      resolved_at = NOW(),                                  │
│      resolved_by_id = $resolver_id                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Awards resolution points (if actionable)                │
│    awardPoints({                                           │
│      staffId: resolvedById,                                │
│      actionType: 'issue_resolution',                       │
│      metadata: { gameId, gameComplexity, issueCategory }   │
│    })                                                      │
│    Points: 500 basic, 1000 complex (×2 if complexity ≥ 3) │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Files**:
- [app/api/issues/[id]/resolve/route.ts](../app/api/issues/[id]/resolve/route.ts)
- [lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts):220 (`completeTask`)
- [lib/services/issues-db-service.ts](../lib/services/issues-db-service.ts):213 (`resolveIssue`)

---

## Database Schema

### staff_list Table (Points Tracking)

```sql
CREATE TABLE staff_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name TEXT NOT NULL,
  nickname TEXT, -- Display name (optional)
  email TEXT UNIQUE,
  points INTEGER DEFAULT 0, -- Total accumulated points
  vikunja_user_id INTEGER, -- Link to Vikunja account
  vikunja_username TEXT, -- Vikunja username
  hire_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_staff_vikunja_user ON staff_list(vikunja_user_id);
```

**Point Updates**: Atomic operation using `UPDATE staff_list SET points = points + $1 WHERE id = $2`

---

### game_issues Table (Issue Tracking)

```sql
CREATE TABLE game_issues (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  reported_by_id UUID NOT NULL REFERENCES staff_list(id),
  issue_category TEXT NOT NULL, -- e.g., 'broken_sleeves', 'needs_sorting'
  issue_type TEXT NOT NULL, -- 'actionable' or 'non_actionable'
  description TEXT NOT NULL,
  vikunja_task_id INTEGER, -- Link to Vikunja task
  resolved_at TIMESTAMP,
  resolved_by_id UUID REFERENCES staff_list(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_game_issues_game ON game_issues(game_id);
CREATE INDEX idx_game_issues_vikunja_task ON game_issues(vikunja_task_id);
CREATE INDEX idx_game_issues_unresolved ON game_issues(resolved_at) WHERE resolved_at IS NULL;
```

**Issue Types**:
- **Actionable**: Creates Vikunja task with "task" label, awards resolution points
- **Non-actionable**: Creates Vikunja task with "note" label, no resolution points

---

### changelog Table (Audit Trail)

```sql
CREATE TABLE changelog (
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'deleted'
  category TEXT NOT NULL, -- 'task', 'issue_report', 'points', etc.
  staff_id UUID REFERENCES staff_list(id),
  entity_id TEXT, -- e.g., game_id or task_id
  entity_name TEXT, -- e.g., game name or task title
  points_awarded INTEGER, -- Points awarded in this action
  point_category TEXT, -- e.g., 'task_complete', 'issue_report'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_changelog_staff ON changelog(staff_id);
CREATE INDEX idx_changelog_points ON changelog(point_category) WHERE point_category IS NOT NULL;
```

**Point Categories Logged**:
- `play_log`, `content_check`, `knowledge_add`, `knowledge_upgrade`
- `teaching`, `photo_upload`, `issue_report`, `issue_resolution`
- `task_complete`

---

## API Reference

### POST /api/games/[id]/report-issue

Create a new issue report and Vikunja task.

**Request Body**:
```typescript
{
  reportedById: string; // UUID of staff member
  issueCategory: string; // One of predefined categories
  issueDescription: string; // Detailed description
  issueType?: 'task' | 'note'; // Optional, v1.5.3+
}
```

**Response**:
```typescript
{
  success: true,
  issue: {
    id: string;
    gameId: string;
    issueCategory: string;
    issueType: 'actionable' | 'non_actionable';
    vikunjaTaskId: number;
    vikunjaIssueType: 'task' | 'note';
    createdAt: string;
  },
  message: string; // Success message with points info
}
```

**Issue Categories**:
- **Actionable** (create tasks): `broken_sleeves`, `needs_sorting`, `needs_cleaning`, `box_rewrap`, `customer_reported`, `other_actionable`
- **Non-actionable** (tracking only): `missing_pieces`, `broken_components`, `damaged_box`, `component_wear`

---

### POST /api/vikunja/tasks/complete

Complete a Vikunja task and award points.

**Request Body**:
```typescript
{
  taskId: number; // Vikunja task ID
  staffId: string; // UUID of staff member
  points: number; // Points to award (from task label)
}
```

**Response**:
```typescript
{
  success: true,
  task: {
    id: number;
    title: string;
    done: boolean;
    // ... other Vikunja task fields
  },
  staff: {
    id: string;
    name: string;
    points: number; // New total
    pointsAwarded: number; // This action
  }
}
```

---

### POST /api/issues/[id]/resolve

Resolve an issue, complete associated task, and award points.

**Request Body**:
```typescript
{
  resolvedById: string; // UUID of staff member resolving issue
}
```

**Response**:
```typescript
{
  success: true,
  issue: {
    id: string;
    gameId: string;
    issueCategory: string;
    issueType: 'actionable' | 'non_actionable';
    resolvedAt: string;
    resolvedById: string;
  },
  message: string; // Success message with points info
}
```

---

### GET /api/vikunja/tasks/priority

Fetch priority tasks for staff dashboard (due within 3 days).

**Query Parameters**: None

**Response**:
```typescript
{
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    due_date: string;
    priority: number;
    points: number; // Extracted from labels
    isOverdue: boolean;
    isDueToday: boolean;
    isDueSoon: boolean; // Due within next 3 days
    labels: Array<{
      id: number;
      title: string; // e.g., "points:500"
      hex_color: string;
    }>;
    assignees: Array<{
      id: number;
      username: string;
      name: string;
    }>;
  }>;
}
```

---

### GET /api/vikunja/board-game-issues

Fetch all unresolved board game issue tasks (Project 25).

**Query Parameters**: None

**Response**:
```typescript
{
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    due_date: string;
    priority: number;
    points: number;
    isOverdue: boolean;
    isDueToday: boolean;
    isDueSoon: boolean;
  }>;
}
```

**Filtering**: Only returns tasks labeled as "task" (excludes "note" observations)

---

## Environment Variables

```bash
# Required for Vikunja integration
VIKUNJA_API_URL=https://tasks.sipnplay.cafe/api/v1
VIKUNJA_API_TOKEN=tk_your_api_token_here

# Required for database operations
DATABASE_URL=postgresql://user:pass@host:port/database
```

**⚠️ Security Note**: The API token grants full access to Vikunja. Keep it secure and never commit to git.

---

## Point Label Management

### Creating Point Labels (Admin Only)

Point labels are created using the script [scripts/create-vikunja-point-labels.js](../scripts/create-vikunja-point-labels.js):

```bash
node scripts/create-vikunja-point-labels.js
```

**Labels Created** (26 total):
- **Point labels (24)**: `points:100` through `points:50000` (IDs 1-24)
- **Issue type labels (2)**: `task`, `note` (IDs 25-26)

### Label ID Mapping

**Current IDs** (Last reset: 2025-11-05 via database sequence reset - v1.5.14)

Comprehensive 24-point label system covering all possible point values the system can award.

Hardcoded in [lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts):263:

```typescript
const labelMap: Record<number, number> = {
  // Small values (100-500)
  100: 1,     // Play log, knowledge upgrade, simple task
  200: 2,     // Knowledge add level 1-2
  300: 3,     // Knowledge add level 1-3
  400: 4,     // Knowledge add level 1-4
  500: 5,     // Knowledge add level 1-5, issue resolution basic

  // Mid values (600-900)
  600: 6,     // Knowledge add level 2-3
  800: 7,     // Knowledge add level 2-4
  900: 8,     // Knowledge add level 3

  // 1000s (content checks, teaching base)
  1000: 9,    // Content check ×1, teaching ×1×1, photo upload
  1200: 10,   // Knowledge add level 3-4
  1500: 11,   // Knowledge add level 3-5, level 4-3
  2000: 12,   // Content check ×2, teaching ×2×1, knowledge level 4-4
  2500: 13,   // Knowledge add level 4-5
  3000: 14,   // Content check ×3, teaching ×3×1 or ×1×3
  4000: 15,   // Content check ×4, teaching ×4×1 or ×2×2
  5000: 16,   // Content check ×5, teaching ×5×1

  // High values (6000-10000)
  6000: 17,   // Teaching ×3×2 or ×2×3
  8000: 18,   // Teaching ×4×2 or ×2×4
  9000: 19,   // Teaching ×3×3
  10000: 20,  // Teaching ×5×2 or ×2×5

  // Very high values (12000-20000)
  12000: 21,  // Teaching ×4×3 or ×3×4
  15000: 22,  // Teaching ×5×3 or ×3×5
  20000: 23,  // Major project, teaching ×4×5

  // Epic values
  50000: 24   // Epic achievement (1+ week)
};
```

**Complete Point Coverage**:
- **Play logs**: 100 points
- **Knowledge adds**: 100-2500 (complexity combinations)
- **Issue resolution**: 500 (basic), 1000 (complex), 2000 (×2 multiplier)
- **Content checks**: 1000-5000 (complexity × 1000)
- **Teaching**: 1000-15000 (complexity × students × 1000)
- **Photo uploads**: 1000 points
- **Major projects**: 20000, 50000 points

**Note**: Labels are created with IDs 1-26 using database sequence reset. To reset: `node scripts/reset-vikunja-db-sequence.js`

---

## Point Extraction System

### Three-Tier Fallback Mechanism

The system uses a **robust point extraction system** that tries multiple methods to determine task points. This ensures points are always captured even if labels fail.

**Implementation**: [lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts):60 (`extractPoints`)

```typescript
export function extractPoints(task: VikunjaTask): number {
  // 1️⃣ PRIMARY: Extract from labels (preferred method)
  if (task.labels && Array.isArray(task.labels) && task.labels.length > 0) {
    const pointLabel = task.labels.find(label =>
      label.title.startsWith('points:')
    );

    if (pointLabel) {
      const pointsStr = pointLabel.title.replace('points:', '');
      return parseInt(pointsStr) || 0;
    }
  }

  // 2️⃣ FALLBACK 1: Parse from task title with format "[XXXpts]"
  const titleMatch = task.title.match(/\[(\d+)pts?\]/i);
  if (titleMatch) {
    return parseInt(titleMatch[1]) || 0;
  }

  // 3️⃣ FALLBACK 2: Parse from description with "earn X points"
  const descMatch = task.description.match(/earn\s+(\d+)\s+points/i);
  if (descMatch) {
    return parseInt(descMatch[1]) || 0;
  }

  return 0; // No points found
}
```

### Point Extraction Methods

| Priority | Method | Format | Example | Use Case |
|----------|--------|--------|---------|----------|
| **1** | Label | `points:500` | Label with ID 5 | Preferred, most reliable |
| **2** | Title | `[500pts]` or `[500pt]` | "Clean shelf [500pts]" | Manual task creation |
| **3** | Description | `earn 500 points` | "Complete this task to resolve the issue and earn 500 points!" | Automated issue reporting |

### Why Multiple Fallbacks?

1. **Label Failures**: If point labels are deleted or IDs change, fallbacks ensure points still work
2. **Manual Tasks**: Users creating tasks via CLI or UI might use title format instead of labels
3. **Automated Tasks**: Issue reporting uses description fallback for consistency

### Example: Automated Issue Task

When a staff member reports a board game issue, the system creates a task like:

```markdown
Title: broken_sleeves - Catan
Description:
**Issue:** Sleeves are torn on multiple cards

**Reported by:** John Doe
**Game ID:** game_123
**Complexity:** 3

Complete this task to resolve the issue and earn 1000 points!
```

**Point Extraction Flow**:
1. Check labels → No `points:` label found
2. Check title → No `[XXXpts]` format found
3. Check description → ✅ **Found "earn 1000 points"** → Returns 1000

**Why Description Fallback?**:
- Ensures backward compatibility if label assignment fails
- Provides clear point value in task description for staff
- More robust than relying solely on labels

---

## Issue Type Labels (v1.5.14+)

### Label Types

Two labels distinguish between actionable tasks and observation notes:

| Label | ID | Description | Points Awarded |
|-------|----|----|----------------|
| `task` | 25 | Actionable issue requiring resolution | Yes (500-1000 + complexity) |
| `note` | 26 | Non-actionable observation for tracking | No (0 points) |

### Creating All Labels (Point + Issue Type)

All 26 labels (24 point labels + 2 issue type labels) are created together:

```bash
node scripts/reset-vikunja-db-sequence.js
```

This script:
1. Deletes all existing labels
2. Resets PostgreSQL sequence to ID 1
3. Creates all 26 labels with correct IDs (1-26)

### Usage in Code

[lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts):323:

```typescript
function getIssueTypeLabelId(issueType: 'task' | 'note'): number {
  return issueType === 'task' ? 25 : 26; // task=25, note=26
}
```

### Filtering Non-Actionable Notes

When fetching board game issues, observation notes (ID 26) are automatically filtered out:

[lib/services/vikunja-service.ts](../lib/services/vikunja-service.ts):432:

```typescript
// Check if task has the 'note' label (ID: 26) - these are observation notes
const hasNoteLabel = task.labels?.some(label => label.id === 26) ?? false;

// Exclude all observation notes - include everything else (actionable tasks)
return !hasNoteLabel;
```

---

## Staff Vikunja Account Setup

All 13 staff members have Vikunja accounts created via [scripts/create-vikunja-accounts.js](../scripts/create-vikunja-accounts.js).

### Account Linking

```sql
-- staff_list table links to Vikunja
vikunja_user_id INTEGER -- Vikunja user ID
vikunja_username TEXT   -- Vikunja username for display
```

### Team Assignment

All staff are members of "Sip n Play" team (ID: 1) for task access.

**Script**: [scripts/add-staff-to-team.js](../scripts/add-staff-to-team.js)

---

## Troubleshooting

### Task Not Created in Vikunja

**Check**:
1. `VIKUNJA_API_TOKEN` is set in environment variables
2. Reporter has `vikunja_user_id` in `staff_list` table
3. API endpoint logs for error details
4. Vikunja API is accessible from server

**Debug**:
```bash
# Test Vikunja API connectivity
curl -H "Authorization: Bearer $VIKUNJA_API_TOKEN" \
  https://tasks.sipnplay.cafe/api/v1/projects
```

---

### Points Not Awarded

**Check**:
1. Changelog table for point award record
2. `staff_list.points` value before/after action
3. API logs for `awardPoints()` failures
4. Point configuration in `points_config` table

**Debug**:
```sql
-- Check recent point awards for a staff member
SELECT * FROM changelog
WHERE staff_id = 'staff_uuid'
  AND point_category IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Verify staff total points
SELECT staff_name, points FROM staff_list
WHERE id = 'staff_uuid';
```

---

### Task Labels Not Showing

**Check**:
1. Label IDs match hardcoded mapping in `vikunja-service.ts`
2. Labels exist in Vikunja (visit `/settings/labels`)
3. Point label created with correct format (`points:500`)

**Recreate Labels**:
```bash
# List existing labels
node scripts/list-vikunja-labels.js

# Create missing point labels
node scripts/create-vikunja-point-labels.js

# Create missing issue type labels
node scripts/create-vikunja-issue-labels.js
```

---

## Related Documentation

- [VIKUNJA_TASK_WORKFLOW.md](VIKUNJA_TASK_WORKFLOW.md) - User guide for task creation
- [VIKUNJA_WORKAROUNDS.md](VIKUNJA_WORKAROUNDS.md) - UI bug workarounds
- [TASK_PROPOSAL_TEMPLATE.md](TASK_PROPOSAL_TEMPLATE.md) - Template for staff task proposals
- [DATABASE_SERVICES_USAGE.md](DATABASE_SERVICES_USAGE.md) - Service layer usage guide

---

## Changelog

### v1.5.12 (Current)
- Bug fixes and UX improvements

### v1.5.11
- Fix staff knowledge API column names

### v1.5.10
- Fix staff_name column references

### v1.5.9
- Staff knowledge display improvements
- Dashboard enhancements
- Points analytics

### v1.5.3
- Added explicit issue types (task/note)
- Issue type labels for Vikunja tasks
- Observation notes (non-actionable) support

### v1.5.0
- Initial issue reporting system
- Points system implementation
- Vikunja integration launch
