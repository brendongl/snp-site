# Issue Reporting & Points System v1.5.0 Implementation

## Overview

Implement a comprehensive issue reporting and points award system that:
- Replaces manual issue reporting with pre-defined categories
- Automatically creates Vikunja tasks for actionable issues
- Awards points across 7 activity types via centralized service
- Tests autonomously with Playwright until all bugs fixed

**Status**: Ready for implementation
**Version**: v1.5.0
**Estimated Time**: 7-10 days

---

## How to Use This Skill

**Start Implementation**:
```
"Start working on issue reporting and points system"
```

**Resume from Checkpoint**:
```
"Continue with issue reporting system implementation"
```

**Skip to Testing**:
```
"Run autonomous testing for points system"
```

---

## Architecture Summary

### Core Design Decisions
- **Approach**: Centralized Points Service + Async with Queue
- **Performance**: Non-blocking point awards (~0ms user impact)
- **Testing**: Autonomous Playwright testing on staging with auto bug fixes
- **Deployment**: Staging-first, autonomous Railway deployment handling

### New Components
1. **Database Table**: `game_issues` (separate from content_checks)
2. **Service**: `lib/services/points-service.ts` (centralized)
3. **Service**: `lib/services/issues-db-service.ts` (issue CRUD)
4. **Vikunja Project**: "Board Game Issues" (auto-task creation)
5. **Frontend**: 5 new/updated components
6. **API Endpoints**: 8 new routes

---

## Implementation Checklist

### Phase 1: Database & Infrastructure (Day 1)

#### 1.1 Create game_issues Table
**File**: `scripts/create-game-issues-table.js`

```javascript
// Create table with:
// - id, game_id, reported_by_id, issue_category, issue_type
// - description, vikunja_task_id, resolved_at, resolved_by_id
// - created_at, updated_at
//
// Indexes:
// - idx_game_issues_game_id
// - idx_game_issues_category
// - idx_game_issues_unresolved (WHERE resolved_at IS NULL)
// - idx_game_issues_vikunja (WHERE vikunja_task_id IS NOT NULL)
```

**Run**: `node scripts/create-game-issues-table.js`
**Verify**: Query table exists, indexes created

- [ ] Script created
- [ ] Script executed on staging database
- [ ] Table and indexes verified

#### 1.2 Add Points Tracking to Changelog
**File**: `scripts/add-points-tracking-to-changelog.js`

```javascript
// ALTER TABLE changelog
// ADD COLUMN points_awarded INTEGER DEFAULT 0,
// ADD COLUMN point_category VARCHAR(50);
```

**Run**: `node scripts/add-points-tracking-to-changelog.js`

- [ ] Script created
- [ ] Script executed on staging database
- [ ] Columns verified

#### 1.3 Create Vikunja Board Game Issues Project
**Options**:
1. Manual: Create via Vikunja UI
2. Script: `scripts/create-vikunja-bg-issues-project.js`

**Steps**:
- Create project "Board Game Issues" as child of "Sip n Play" (project ID 1)
- Note the new project ID (likely 3)
- Add to `.env`: `VIKUNJA_BG_ISSUES_PROJECT_ID=3`

- [ ] Project created
- [ ] Project ID noted
- [ ] Environment variable added

---

### Phase 2: Backend Services (Day 2-3)

#### 2.1 Create Points Service
**File**: `lib/services/points-service.ts` (NEW)

**Implementation**:

```typescript
import { db } from '@/lib/db/postgres';
import { changelog } from '@/lib/db/schema';
import { logger } from '@/lib/logger';

interface PointAwardParams {
  staffId: string;
  actionType: 'play_log' | 'content_check' | 'knowledge_add' |
               'knowledge_upgrade' | 'teaching' | 'photo_upload' |
               'issue_report' | 'issue_resolution';
  metadata: {
    gameId?: string;
    gameComplexity?: number;
    knowledgeLevel?: number;
    studentCount?: number;
    issueCategory?: string;
  };
  context?: string;
}

interface PointAwardResult {
  success: boolean;
  pointsAwarded: number;
  newTotalPoints: number;
  changelogId?: string;
  error?: string;
}

export class PointsService {
  // Calculate points based on action type and metadata
  static calculatePoints(params: PointAwardParams): number {
    const { actionType, metadata } = params;
    const complexity = metadata.gameComplexity || 1;

    switch (actionType) {
      case 'play_log':
        return 100;

      case 'content_check':
        return 1000 * complexity;

      case 'knowledge_add':
        const levelMultipliers = {
          1: 100,  // Beginner
          2: 200,  // Intermediate
          3: 300,  // Expert
          4: 500   // Instructor
        };
        const multiplier = levelMultipliers[metadata.knowledgeLevel || 1];
        return multiplier * complexity;

      case 'knowledge_upgrade':
        return 100 * complexity;

      case 'teaching':
        const students = metadata.studentCount || 1;
        return 1000 * complexity * students;

      case 'photo_upload':
        return 1000;

      case 'issue_report':
        return 100; // Reporter bonus

      case 'issue_resolution':
        const basePoints = this.getIssueResolutionPoints(
          metadata.issueCategory
        );
        return complexity >= 3 ? basePoints * 2 : basePoints;

      default:
        return 0;
    }
  }

  private static getIssueResolutionPoints(category: string): number {
    const pointMap = {
      'broken_sleeves': 500,
      'needs_sorting': 500,
      'needs_cleaning': 500,
      'box_rewrap': 1000,
      'customer_reported': 0, // Just triggers content check
      'other_actionable': 500
    };
    return pointMap[category] || 0;
  }

  // Award points (async, non-blocking)
  static async awardPoints(params: PointAwardParams): Promise<PointAwardResult> {
    try {
      const points = this.calculatePoints(params);

      if (points === 0) {
        return { success: true, pointsAwarded: 0, newTotalPoints: 0 };
      }

      // Atomic update
      const result = await db.query(`
        UPDATE staff_list
        SET points = points + $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING points
      `, [points, params.staffId]);

      const newTotal = result.rows[0]?.points || 0;

      // Log to changelog
      const changelogId = await this.logPointAward(params, points);

      logger.info(`Points awarded: ${points} to staff ${params.staffId}`, {
        actionType: params.actionType,
        metadata: params.metadata
      });

      return {
        success: true,
        pointsAwarded: points,
        newTotalPoints: newTotal,
        changelogId
      };

    } catch (error) {
      logger.error('Point award failed:', error);
      return {
        success: false,
        pointsAwarded: 0,
        newTotalPoints: 0,
        error: error.message
      };
    }
  }

  private static async logPointAward(
    params: PointAwardParams,
    points: number
  ): Promise<string> {
    const changelogEntry = {
      id: `changelog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      event_type: 'points_awarded',
      staff_id: params.staffId,
      game_id: params.metadata.gameId,
      points_awarded: points,
      point_category: params.actionType,
      description: params.context || `Points awarded for ${params.actionType}`,
      created_at: new Date()
    };

    await db.insert(changelog).values(changelogEntry);
    return changelogEntry.id;
  }
}
```

**Testing**:
- Unit tests for all 7 point formulas
- Verify atomic updates (no race conditions)
- Test async error handling

- [ ] PointsService implemented
- [ ] Unit tests written
- [ ] Tests passing

#### 2.2 Create Issues Database Service
**File**: `lib/services/issues-db-service.ts` (NEW)

```typescript
import { db } from '@/lib/db/postgres';
import { game_issues } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

export class IssuesDbService {
  static async createIssue(data: {
    gameId: string;
    reportedById: string;
    issueCategory: string;
    issueType: 'actionable' | 'non_actionable';
    description: string;
    vikunjaTaskId?: number;
  }) {
    const issue = {
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      game_id: data.gameId,
      reported_by_id: data.reportedById,
      issue_category: data.issueCategory,
      issue_type: data.issueType,
      description: data.description,
      vikunja_task_id: data.vikunjaTaskId || null,
      resolved_at: null,
      resolved_by_id: null,
      created_at: new Date()
    };

    await db.insert(game_issues).values(issue);
    return issue;
  }

  static async getUnresolvedIssuesByGameId(gameId: string) {
    return await db
      .select()
      .from(game_issues)
      .where(
        and(
          eq(game_issues.game_id, gameId),
          isNull(game_issues.resolved_at)
        )
      )
      .orderBy(desc(game_issues.created_at));
  }

  static async getAllNonActionableIssues() {
    return await db
      .select({
        issue: game_issues,
        game: games,
        reporter: staff_list
      })
      .from(game_issues)
      .leftJoin(games, eq(game_issues.game_id, games.id))
      .leftJoin(staff_list, eq(game_issues.reported_by_id, staff_list.id))
      .where(
        and(
          eq(game_issues.issue_type, 'non_actionable'),
          isNull(game_issues.resolved_at)
        )
      )
      .orderBy(desc(game_issues.created_at));
  }

  static async resolveIssue(issueId: string, resolvedById: string) {
    return await db
      .update(game_issues)
      .set({
        resolved_at: new Date(),
        resolved_by_id: resolvedById,
        updated_at: new Date()
      })
      .where(eq(game_issues.id, issueId))
      .returning();
  }

  static async getIssueByVikunjaTaskId(taskId: number) {
    const results = await db
      .select()
      .from(game_issues)
      .where(eq(game_issues.vikunja_task_id, taskId))
      .limit(1);
    return results[0] || null;
  }
}
```

- [ ] IssuesDbService implemented
- [ ] Methods tested
- [ ] Database queries verified

#### 2.3 Update Vikunja Service
**File**: `lib/services/vikunja-service.ts` (UPDATE)

**Add these methods**:

```typescript
export async function createBoardGameIssueTask(params: {
  gameName: string;
  gameId: string;
  gameComplexity: number;
  issueCategory: string;
  issueDescription: string;
  reportedBy: string;
  reportedByVikunjaUserId: number;
}): Promise<number> {
  const projectId = parseInt(process.env.VIKUNJA_BG_ISSUES_PROJECT_ID || '3');

  const basePoints = getIssueResolutionPoints(params.issueCategory);
  const points = params.gameComplexity >= 3 ? basePoints * 2 : basePoints;
  const dueDate = calculateDueDate(params.issueCategory);
  const priority = calculatePriority(params.issueCategory);

  const response = await fetch(`${VIKUNJA_API_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VIKUNJA_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `${params.issueCategory.replace(/_/g, ' ')} - ${params.gameName}`,
      description: `
**Issue:** ${params.issueDescription}

**Reported by:** ${params.reportedBy}
**Game ID:** ${params.gameId}
**Complexity:** ${params.gameComplexity}

Complete this task to resolve the issue and earn ${points} points!
      `.trim(),
      dueDate: dueDate,
      priority: priority,
      labels: [`points:${points}`],
      assignees: [{ id: params.reportedByVikunjaUserId }]
    })
  });

  const result = await response.json();
  return result.id;
}

function getIssueResolutionPoints(category: string): number {
  const pointMap = {
    'broken_sleeves': 500,
    'needs_sorting': 500,
    'needs_cleaning': 500,
    'box_rewrap': 1000,
    'other_actionable': 500
  };
  return pointMap[category] || 0;
}

function calculateDueDate(issueCategory: string): string {
  const urgencyMap = {
    'broken_sleeves': 7,
    'needs_sorting': 3,
    'needs_cleaning': 2,
    'box_rewrap': 7,
    'customer_reported': 1,
    'other_actionable': 3
  };

  const daysUntilDue = urgencyMap[issueCategory] || 3;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + daysUntilDue);
  return dueDate.toISOString();
}

function calculatePriority(issueCategory: string): number {
  const priorityMap = {
    'customer_reported': 5,
    'needs_cleaning': 4,
    'broken_sleeves': 3,
    'needs_sorting': 3,
    'box_rewrap': 2,
    'other_actionable': 3
  };
  return priorityMap[issueCategory] || 3;
}

export async function getBoardGameIssueTasks(): Promise<TaskWithPoints[]> {
  const projectId = parseInt(process.env.VIKUNJA_BG_ISSUES_PROJECT_ID || '3');

  const response = await fetch(
    `${VIKUNJA_API_URL}/projects/${projectId}/tasks`,
    {
      headers: { 'Authorization': `Bearer ${VIKUNJA_API_TOKEN}` }
    }
  );

  const tasks = await response.json();

  return tasks
    .filter(task => !task.done)
    .map(task => enhanceTask(task));
}
```

- [ ] Vikunja service methods added
- [ ] Task creation tested
- [ ] Due dates and priorities verified

#### 2.4 Update Existing Services with Point Awards

**Files to update**:
- `lib/services/play-logs-db-service.ts`
- `lib/services/content-checks-db-service.ts`
- `lib/services/staff-knowledge-db-service.ts`
- `lib/services/changelog-service.ts`

**Pattern** (add after main operation):

```typescript
// Example: play-logs-db-service.ts
async createLog(data: PlayLogData) {
  const log = await db.insert(play_logs).values(data).returning();

  // Award points (non-blocking)
  PointsService.awardPoints({
    staffId: data.staff_id,
    actionType: 'play_log',
    metadata: {},
    context: `Play log for game ${data.game_id}`
  }).catch(err => logger.error('Point award failed:', err));

  return log;
}
```

- [ ] play-logs-db-service.ts updated
- [ ] content-checks-db-service.ts updated
- [ ] staff-knowledge-db-service.ts updated
- [ ] changelog-service.ts updated

---

### Phase 3: API Endpoints (Day 3-4)

#### 3.1 Create Issue Report Endpoint
**File**: `app/api/game-issues/create/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { IssuesDbService } from '@/lib/services/issues-db-service';
import { PointsService } from '@/lib/services/points-service';
import { vikunjaService } from '@/lib/services/vikunja-service';
import { GamesDbService } from '@/lib/services/games-db-service';
import { StaffDbService } from '@/lib/services/staff-db-service';

export async function POST(req: Request) {
  try {
    const { gameId, reportedById, issueCategory, description } = await req.json();

    // Determine if actionable
    const actionableCategories = [
      'broken_sleeves', 'needs_sorting', 'needs_cleaning',
      'box_rewrap', 'customer_reported', 'other_actionable'
    ];
    const issueType = actionableCategories.includes(issueCategory)
      ? 'actionable'
      : 'non_actionable';

    let vikunjaTaskId = null;

    // Create Vikunja task if actionable
    if (issueType === 'actionable') {
      const game = await GamesDbService.getGameById(gameId);
      const staff = await StaffDbService.getStaffById(reportedById);

      vikunjaTaskId = await vikunjaService.createBoardGameIssueTask({
        gameName: game.name,
        gameId: game.id,
        gameComplexity: game.complexity || 1,
        issueCategory,
        issueDescription: description,
        reportedBy: staff.name,
        reportedByVikunjaUserId: staff.vikunja_user_id
      });
    }

    // Create issue in database
    const issue = await IssuesDbService.createIssue({
      gameId,
      reportedById,
      issueCategory,
      issueType,
      description,
      vikunjaTaskId
    });

    // Award reporter bonus (+100 points)
    const pointResult = await PointsService.awardPoints({
      staffId: reportedById,
      actionType: 'issue_report',
      metadata: { gameId },
      context: `Reported ${issueCategory} for ${game.name}`
    });

    return NextResponse.json({
      success: true,
      issue,
      vikunjaTaskId,
      reporterPoints: pointResult.pointsAwarded
    });

  } catch (error) {
    console.error('Issue creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested with actionable issue
- [ ] Tested with non-actionable issue

#### 3.2 Get Issues for Game
**File**: `app/api/game-issues/[gameId]/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { IssuesDbService } from '@/lib/services/issues-db-service';

export async function GET(
  req: Request,
  { params }: { params: { gameId: string } }
) {
  try {
    const issues = await IssuesDbService.getUnresolvedIssuesByGameId(params.gameId);

    const actionableCount = issues.filter(i => i.issue_type === 'actionable').length;
    const nonActionableCount = issues.filter(i => i.issue_type === 'non_actionable').length;

    return NextResponse.json({
      issues,
      actionableCount,
      nonActionableCount
    });
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested

#### 3.3 Get All Non-Actionable Issues
**File**: `app/api/game-issues/non-actionable/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { IssuesDbService } from '@/lib/services/issues-db-service';

export async function GET(req: Request) {
  try {
    const issues = await IssuesDbService.getAllNonActionableIssues();

    return NextResponse.json({
      issues,
      totalCount: issues.length
    });
  } catch (error) {
    console.error('Failed to fetch non-actionable issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested

#### 3.4 Resolve Issue
**File**: `app/api/game-issues/[id]/resolve/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { IssuesDbService } from '@/lib/services/issues-db-service';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { resolvedById, notes } = await req.json();

    const issue = await IssuesDbService.resolveIssue(params.id, resolvedById);

    return NextResponse.json({
      success: true,
      issue
    });
  } catch (error) {
    console.error('Failed to resolve issue:', error);
    return NextResponse.json(
      { error: 'Failed to resolve issue' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested

#### 3.5 Get Board Game Issue Tasks
**File**: `app/api/vikunja/tasks/board-game-issues/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { getBoardGameIssueTasks } from '@/lib/services/vikunja-service';

export async function GET(req: Request) {
  try {
    const tasks = await getBoardGameIssueTasks();

    const totalPoints = tasks.reduce((sum, task) => sum + (task.points || 0), 0);

    return NextResponse.json({
      tasks,
      count: tasks.length,
      totalPoints
    });
  } catch (error) {
    console.error('Failed to fetch BG issue tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested

#### 3.6 Complete Board Game Issue Task
**File**: `app/api/vikunja/tasks/complete-board-game-issue/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { IssuesDbService } from '@/lib/services/issues-db-service';
import { GamesDbService } from '@/lib/services/games-db-service';
import { PointsService } from '@/lib/services/points-service';
import { completeTask } from '@/lib/services/vikunja-service';

export async function POST(req: Request) {
  try {
    const { taskId, staffId } = await req.json();

    // Get issue from database
    const issue = await IssuesDbService.getIssueByVikunjaTaskId(taskId);
    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    // Get game for complexity
    const game = await GamesDbService.getGameById(issue.game_id);

    // Complete task in Vikunja
    await completeTask(taskId);

    // Mark issue resolved
    await IssuesDbService.resolveIssue(issue.id, staffId);

    // Award points for resolution
    const pointResult = await PointsService.awardPoints({
      staffId,
      actionType: 'issue_resolution',
      metadata: {
        gameId: game.id,
        gameComplexity: game.complexity,
        issueCategory: issue.issue_category
      },
      context: `Resolved ${issue.issue_category} for ${game.name}`
    });

    return NextResponse.json({
      success: true,
      issue,
      pointsAwarded: pointResult.pointsAwarded,
      newTotalPoints: pointResult.newTotalPoints
    });

  } catch (error) {
    console.error('Failed to complete issue task:', error);
    return NextResponse.json(
      { error: 'Failed to complete task' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested

#### 3.7 Get Staff Points Breakdown
**File**: `app/api/staff/[id]/points-breakdown/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/postgres';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Get total points
    const staffResult = await db.query(
      'SELECT points FROM staff_list WHERE id = $1',
      [params.id]
    );
    const totalPoints = staffResult.rows[0]?.points || 0;

    // Get breakdown by category
    const breakdownResult = await db.query(`
      SELECT
        point_category,
        COUNT(*) as count,
        SUM(points_awarded) as points
      FROM changelog
      WHERE staff_id = $1 AND point_category IS NOT NULL
      GROUP BY point_category
    `, [params.id]);

    const breakdown = breakdownResult.rows.reduce((acc, row) => {
      acc[row.point_category] = {
        count: parseInt(row.count),
        points: parseInt(row.points)
      };
      return acc;
    }, {});

    // Get recent awards
    const recentResult = await db.query(`
      SELECT * FROM changelog
      WHERE staff_id = $1 AND point_category IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `, [params.id]);

    return NextResponse.json({
      totalPoints,
      breakdown,
      recentAwards: recentResult.rows
    });

  } catch (error) {
    console.error('Failed to fetch points breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch breakdown' },
      { status: 500 }
    );
  }
}
```

- [ ] Endpoint created
- [ ] Tested

---

### Phase 4: Frontend Components (Day 4-6)

#### 4.1 Update GameCard Component
**File**: `components/features/games/GameCard.tsx` (UPDATE)

**Add 📋 button**:
- Position: Centered between content check and play log icons
- Staff mode only
- Opens ContentCheckOrIssueDialog

```typescript
// Add to icon overlay section
{staffMode && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setShowContentCheckOrIssueDialog(true);
    }}
    className="absolute bottom-2 left-1/2 transform -translate-x-1/2
               bg-white/90 rounded-full p-2 hover:bg-white transition-colors"
    title="Content Check or Report Issue"
  >
    <span className="text-2xl">📋</span>
  </button>
)}
```

- [ ] Button added
- [ ] Positioning verified
- [ ] Staff mode visibility tested

#### 4.2 Create ContentCheckOrIssueDialog
**File**: `components/features/content-check/ContentCheckOrIssueDialog.tsx` (NEW)

```typescript
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ContentCheckOrIssueDialogProps {
  game: Game;
  isOpen: boolean;
  onClose: () => void;
  onOpenContentCheck: () => void;
  onOpenIssueReport: () => void;
}

export function ContentCheckOrIssueDialog({
  game,
  isOpen,
  onClose,
  onOpenContentCheck,
  onOpenIssueReport
}: ContentCheckOrIssueDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>What would you like to do?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Button
            onClick={() => {
              onClose();
              onOpenContentCheck();
            }}
            className="w-full h-20 text-lg"
            variant="outline"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1">📝</span>
              <span>Perform Full Content Check</span>
              <span className="text-xs text-muted-foreground">
                Count all pieces and inspect condition
              </span>
            </div>
          </Button>

          <Button
            onClick={() => {
              onClose();
              onOpenIssueReport();
            }}
            className="w-full h-20 text-lg"
            variant="outline"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl mb-1">⚠️</span>
              <span>Report an Issue</span>
              <span className="text-xs text-muted-foreground">
                Quick issue report without full check
              </span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] Component created
- [ ] Tested button navigation
- [ ] Dialog behavior verified

#### 4.3 Create IssueReportDialog
**File**: `components/features/content-check/IssueReportDialog.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface IssueReportDialogProps {
  game: Game;
  staffId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ISSUE_TYPES = {
  actionable: [
    { value: 'broken_sleeves', label: 'Broken sleeves', requiresNote: false },
    { value: 'needs_sorting', label: 'Needs sorting/organization', requiresNote: false },
    { value: 'needs_cleaning', label: 'Needs cleaning', requiresNote: false },
    { value: 'box_rewrap', label: 'Box needs re-wrapping', requiresNote: false },
    { value: 'customer_reported', label: 'Customer reported Issue', requiresNote: true },
    { value: 'other_actionable', label: 'Other Issue', requiresNote: true },
  ],
  non_actionable: [
    { value: 'missing_pieces', label: 'Missing pieces', requiresNote: true },
    { value: 'broken_components', label: 'Broken components', requiresNote: true },
    { value: 'damaged_box', label: 'Damaged box', requiresNote: false },
    { value: 'component_wear', label: 'Component wear', requiresNote: false },
  ]
};

export function IssueReportDialog({
  game,
  staffId,
  isOpen,
  onClose,
  onSuccess
}: IssueReportDialogProps) {
  const [issueCategory, setIssueCategory] = useState('');
  const [description, setDescription] = useState('');
  const [showOtherIssueConfirm, setShowOtherIssueConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedIssueType = [...ISSUE_TYPES.actionable, ...ISSUE_TYPES.non_actionable]
    .find(type => type.value === issueCategory);

  const isNoteRequired = selectedIssueType?.requiresNote || false;

  const handleSubmit = async () => {
    if (!issueCategory) {
      alert('Please select an issue type');
      return;
    }

    if (isNoteRequired && !description.trim()) {
      alert('Please provide a description for this issue');
      return;
    }

    // Show confirmation for "Other Issue"
    if (issueCategory === 'other_actionable' && !showOtherIssueConfirm) {
      setShowOtherIssueConfirm(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/game-issues/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          reportedById: staffId,
          issueCategory,
          description: description.trim()
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Issue reported! You earned +${result.reporterPoints} points.`);
        onSuccess();
        onClose();
      } else {
        alert('Failed to report issue');
      }
    } catch (error) {
      console.error('Failed to report issue:', error);
      alert('Failed to report issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showOtherIssueConfirm) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ Before continuing</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm">
              "Other Issue" is for tasks that staff can resolve themselves.
            </p>
            <p className="font-medium">
              Can this issue be fixed by staff action?
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowOtherIssueConfirm(false);
                  handleSubmit();
                }}
                className="flex-1"
              >
                Yes, staff can fix this
              </Button>
              <Button
                onClick={() => {
                  setIssueCategory('');
                  setShowOtherIssueConfirm(false);
                  alert('Please select a non-actionable issue type instead');
                }}
                variant="outline"
                className="flex-1"
              >
                No, just tracking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Issue: {game.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div>
            <Label className="text-base font-semibold">
              Actionable Issues (Creates Task):
            </Label>
            <RadioGroup value={issueCategory} onValueChange={setIssueCategory}>
              {ISSUE_TYPES.actionable.map(type => (
                <div key={type.value} className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label htmlFor={type.value} className="cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-base font-semibold">
              Non-Actionable Issues (Logs Only):
            </Label>
            <RadioGroup value={issueCategory} onValueChange={setIssueCategory}>
              {ISSUE_TYPES.non_actionable.map(type => (
                <div key={type.value} className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value={type.value} id={type.value} />
                  <Label htmlFor={type.value} className="cursor-pointer">
                    {type.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="description">
              Additional notes {isNoteRequired && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              className="mt-2"
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] Component created
- [ ] Validation tested
- [ ] "Other Issue" confirmation tested
- [ ] API integration tested

#### 4.4 Update Staff Dashboard
**File**: `app/staff/dashboard/page.tsx` (UPDATE)

**Changes**:
- Rename "Games Needing Attention" to "Board Game Issues"
- Fetch from `/api/vikunja/tasks/board-game-issues`
- Display Vikunja tasks instead of content check issues

```typescript
// Replace existing "Games Needing Attention" section

const [bgIssueTasks, setBgIssueTasks] = useState([]);

useEffect(() => {
  async function fetchBgIssueTasks() {
    try {
      const response = await fetch('/api/vikunja/tasks/board-game-issues');
      const data = await response.json();
      setBgIssueTasks(data.tasks);
    } catch (error) {
      console.error('Failed to fetch BG issue tasks:', error);
    }
  }
  fetchBgIssueTasks();
}, []);

// Render section
<CollapsibleSection
  title="Board Game Issues"
  icon="⚠️"
  count={bgIssueTasks.length}
  defaultOpen={true}
>
  {bgIssueTasks.length === 0 ? (
    <p className="text-muted-foreground">No actionable issues</p>
  ) : (
    <div className="space-y-2">
      {bgIssueTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={() => handleCompleteIssueTask(task.id)}
        />
      ))}
    </div>
  )}
</CollapsibleSection>
```

- [ ] Section renamed
- [ ] Endpoint integration added
- [ ] Task cards displaying correctly

#### 4.5 Create Issues Overview Page
**File**: `app/staff/issues/page.tsx` (NEW)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function IssuesOverviewPage() {
  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchIssues() {
      try {
        const response = await fetch('/api/game-issues/non-actionable');
        const data = await response.json();
        setIssues(data.issues);
      } catch (error) {
        console.error('Failed to fetch issues:', error);
      }
    }
    fetchIssues();
  }, []);

  const filteredIssues = filter === 'all'
    ? issues
    : issues.filter(item => item.issue.issue_category === filter);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Non-Actionable Issues</h1>

      <div className="mb-6 flex gap-2">
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'default' : 'outline'}
        >
          All ({issues.length})
        </Button>
        <Button
          onClick={() => setFilter('missing_pieces')}
          variant={filter === 'missing_pieces' ? 'default' : 'outline'}
        >
          Missing Pieces
        </Button>
        <Button
          onClick={() => setFilter('broken_components')}
          variant={filter === 'broken_components' ? 'default' : 'outline'}
        >
          Broken Components
        </Button>
        <Button
          onClick={() => setFilter('damaged_box')}
          variant={filter === 'damaged_box' ? 'default' : 'outline'}
        >
          Damaged Box
        </Button>
        <Button
          onClick={() => setFilter('component_wear')}
          variant={filter === 'component_wear' ? 'default' : 'outline'}
        >
          Component Wear
        </Button>
      </div>

      <div className="space-y-4">
        {filteredIssues.map(item => (
          <Card key={item.issue.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{item.game.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {item.issue.issue_category.replace(/_/g, ' ')}
                </p>
                <p className="mt-2">{item.issue.description}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Reported by {item.reporter.name} on{' '}
                  {new Date(item.issue.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button size="sm" variant="outline">
                Mark Resolved
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] Page created
- [ ] Filters working
- [ ] Resolve button functional

#### 4.6 Add "Has Issues" Filter to Games Gallery
**File**: `app/games/page.tsx` (UPDATE)

**Add to filters section**:
```typescript
<Checkbox
  id="hasIssues"
  checked={filters.hasIssues}
  onCheckedChange={(checked) =>
    setFilters(prev => ({ ...prev, hasIssues: checked }))
  }
/>
<Label htmlFor="hasIssues">Has Issues</Label>
```

**Update fetch logic**:
```typescript
const params = new URLSearchParams();
if (filters.hasIssues) {
  params.append('hasIssues', 'true');
}

const response = await fetch(`/api/games?${params}`);
```

- [ ] Filter checkbox added
- [ ] API query parameter implemented
- [ ] Games with issues displayed correctly

---

### Phase 5: Autonomous Testing (Automated)

**Testing Protocol**: Completely unsupervised testing via Playwright MCP on staging URL

#### Test Suite: All 7 Point Creation Endpoints

**Staging URL**: Will be determined from Railway deployment

**Test 1: Play Log Points**
```
1. Navigate to staging URL
2. Log in as test staff member
3. Open game detail modal
4. Create play log
5. Verify staff points increased by 100
6. Verify changelog entry created with point_category = 'play_log'
7. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

**Test 2: Content Check Points**
```
1. Open game with complexity = 2
2. Perform full content check (Perfect Condition)
3. Verify staff points increased by 2000 (1000 × 2)
4. Verify changelog entry with point_category = 'content_check'
5. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

**Test 3: Knowledge Add Points**
```
1. Navigate to Add Knowledge page
2. Add Expert knowledge (level 3) for complexity 3 game
3. Verify staff points increased by 900 (300 × 3)
4. Verify changelog entry with point_category = 'knowledge_add'
5. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

**Test 4: Teaching Points**
```
1. Add knowledge with taught_by = another staff member's UUID
2. Verify teacher points increased by 3000 (1000 × 3 × 1)
3. Verify changelog entry with point_category = 'teaching'
4. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

**Test 5: Photo Upload Points**
```
1. Upload photo for a game
2. Verify staff points increased by 1000
3. Verify changelog entry with event_type = 'photo_added'
4. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

**Test 6: Issue Report Points**
```
1. Open game detail modal
2. Click 📋 button
3. Select "Report an Issue"
4. Choose "Broken sleeves"
5. Submit report
6. Verify reporter gets +100 points
7. Verify Vikunja task created in BG Issues project
8. Verify changelog entry with point_category = 'issue_report'
9. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

**Test 7: Issue Resolution Points**
```
1. Navigate to Staff Dashboard
2. Find task in "Board Game Issues" section
3. Click "Complete Task" button
4. Verify resolver points increased (500 or 1000 based on complexity)
5. Verify issue marked resolved in database
6. Verify changelog entry with point_category = 'issue_resolution'
7. If test fails → Debug, fix, commit, push, wait for deployment, retry
```

#### Railway Deployment Handling

**Automatic Deployment Waiting**:
```
After git push to staging:
1. Wait 10 seconds (build initialization)
2. Poll /api/health every 30 seconds
3. Check for 200 OK response
4. If timeout after 10 minutes → Log error, retry once
5. When healthy → Continue testing
6. NEVER ask user for confirmation
```

#### Bug Fix Loop

**Autonomous Bug Fixing**:
```
When test fails:
1. Capture error details:
   - Playwright screenshot
   - Console logs
   - Network logs
   - Database state (query via API)
2. Analyze root cause:
   - Is it a service error?
   - Is it a database error?
   - Is it an API error?
   - Is it a frontend error?
3. Implement fix
4. Run npm run build locally to verify no errors
5. Commit fix with descriptive message
6. Push to staging branch
7. Wait for Railway deployment (poll /api/health)
8. Re-run failed test
9. If still fails → Repeat from step 1
10. If passes → Continue to next test
```

**Never Stop Until**:
- All 7 tests pass successfully
- All point awards confirmed in database
- All changelog entries verified
- Performance verified (<200ms API responses)

- [ ] Test suite implemented
- [ ] Railway deployment polling implemented
- [ ] Bug fix loop implemented
- [ ] All tests passing

---

### Phase 6: Production Deployment

#### 6.1 Create Design Document
**File**: `docs/plans/2025-01-04-issue-reporting-points-system-v1.5.0-design.md`

Write complete design document with:
- Architecture overview
- Database schema
- API endpoints
- Frontend components
- Testing results

- [ ] Design document created
- [ ] Committed to repository

#### 6.2 Update Version
**Files**:
- `lib/version.ts`: Change to `'1.5.0'`
- `package.json`: Change version to `"1.5.0"`

- [ ] Version updated in both files

#### 6.3 Update CHANGELOG.md
Add v1.5.0 entry:
```markdown
## v1.5.0 - Issue Reporting & Points System

### New Features
- Pre-defined issue reporting workflow with automatic task creation
- Centralized points service across 7 activity types
- Board Game Issues Vikunja project integration
- Non-actionable issues tracking and overview page
- Staff points breakdown API

### Database Changes
- New table: game_issues
- Updated table: changelog (points tracking columns)

### Point Awards
- Play logs: 100 points
- Content checks: 1000 × complexity
- Knowledge adds: level × complexity (100-500)
- Teaching: 1000 × complexity × students
- Photos: 1000 points
- Issue reports: 100 points (reporter bonus)
- Issue resolutions: 500-1000 (×2 if complexity ≥ 3)

### Testing
- Autonomous Playwright testing on staging
- All 7 point endpoints verified
- Performance: <200ms API response times
```

- [ ] CHANGELOG.md updated

#### 6.4 Commit and Push to Staging
```bash
git add .
git commit -m "v1.5.0 - Issue Reporting & Points System

Complete implementation of pre-defined issue reporting workflow,
centralized points service, and Vikunja Board Game Issues integration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

- [ ] Committed to staging
- [ ] Tested on staging environment

#### 6.5 Push to Main (After User Approval)
Wait for user to say "push to main"

```bash
git push origin main
```

- [ ] Pushed to main
- [ ] Production deployment verified
- [ ] 24-hour monitoring period

---

## Success Metrics

**Week 1 Post-launch**:
- [ ] 90%+ of issue reports use new flow
- [ ] Zero user-reported slowdowns
- [ ] <5% point award failures

**Month 1**:
- [ ] 100+ Vikunja tasks created automatically
- [ ] 50+ tasks completed by staff
- [ ] Staff dashboard "Board Game Issues" used daily

---

## Troubleshooting

### Point Awards Not Working
1. Check database connection
2. Verify PointsService.awardPoints() is called
3. Check changelog table for point_category entries
4. Verify staff_list.points column updated

### Vikunja Tasks Not Created
1. Verify VIKUNJA_BG_ISSUES_PROJECT_ID environment variable
2. Check Vikunja API token
3. Verify project exists and staff has access
4. Check network logs for API errors

### Autonomous Testing Stuck
1. Check Railway deployment status manually
2. Verify /api/health endpoint responding
3. Check Playwright browser logs
4. Restart testing from last checkpoint

---

## Rollback Plan

If critical issues arise:
1. **Database**: Keep old content_checks.has_issue parallel operation
2. **Points**: Failures don't affect main operations (async)
3. **Vikunja**: Disable auto-task creation via feature flag
4. **Frontend**: Hide 📋 button via environment variable

---

## Skill Status

**Implementation Status**: ⏸️ Ready to Start

**Last Updated**: 2025-01-04

**Progress Checkpoint**: Phase 1 (Not Started)

---

## Notes for Claude Code

When this skill is invoked:
1. Start from Phase 1 if no checkpoint exists
2. Resume from last checkpoint if one exists
3. Execute autonomously without asking for confirmation
4. Use Playwright MCP for testing
5. Never stop during testing until all bugs fixed
6. Poll Railway deployments automatically
7. Update this file with progress checkpoints
