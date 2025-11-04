/**
 * POST /api/games/[id]/report-issue
 *
 * Report a new issue for a board game
 * - Determines if issue is actionable or non-actionable based on category
 * - Creates Vikunja task for actionable issues
 * - Awards 100 point reporter bonus to all issue reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createIssue } from '@/lib/services/issues-db-service';
import { createBoardGameIssueTask } from '@/lib/services/vikunja-service';
import { awardPoints } from '@/lib/services/points-service';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Issue categories and their types
 */
const ISSUE_CATEGORIES = {
  // Actionable issues (create Vikunja tasks)
  'broken_sleeves': 'actionable',
  'needs_sorting': 'actionable',
  'needs_cleaning': 'actionable',
  'box_rewrap': 'actionable',
  'customer_reported': 'actionable',
  'other_actionable': 'actionable',

  // Non-actionable issues (tracking only)
  'missing_pieces': 'non_actionable',
  'broken_components': 'non_actionable',
  'damaged_box': 'non_actionable',
  'component_wear': 'non_actionable'
} as const;

type IssueCategory = keyof typeof ISSUE_CATEGORIES;

interface ReportIssueRequest {
  reportedById: string;
  issueCategory: IssueCategory;
  issueDescription: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    const body: ReportIssueRequest = await request.json();

    // Validate input
    if (!body.reportedById || !body.issueCategory || !body.issueDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: reportedById, issueCategory, issueDescription' },
        { status: 400 }
      );
    }

    // Validate issue category
    if (!(body.issueCategory in ISSUE_CATEGORIES)) {
      return NextResponse.json(
        { error: `Invalid issue category. Must be one of: ${Object.keys(ISSUE_CATEGORIES).join(', ')}` },
        { status: 400 }
      );
    }

    const issueType = ISSUE_CATEGORIES[body.issueCategory];

    // Fetch game details for Vikunja task creation (if actionable)
    let vikunjaTaskId: number | undefined;

    if (issueType === 'actionable') {
      const gameResult = await pool.query(
        'SELECT name, complexity FROM games WHERE id = $1',
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Game not found' },
          { status: 404 }
        );
      }

      const game = gameResult.rows[0];

      // Fetch reporter details for Vikunja assignment
      const staffResult = await pool.query(
        'SELECT staff_name, vikunja_user_id FROM staff_list WHERE id = $1',
        [body.reportedById]
      );

      if (staffResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Reporter not found in staff list' },
          { status: 404 }
        );
      }

      const reporter = staffResult.rows[0];

      if (!reporter.vikunja_user_id) {
        return NextResponse.json(
          { error: 'Reporter does not have a Vikunja account linked' },
          { status: 400 }
        );
      }

      // Create Vikunja task for actionable issues
      try {
        vikunjaTaskId = await createBoardGameIssueTask({
          gameName: game.name,
          gameId: gameId,
          gameComplexity: game.complexity,
          issueCategory: body.issueCategory,
          issueDescription: body.issueDescription,
          reportedBy: reporter.staff_name,
          reportedByVikunjaUserId: reporter.vikunja_user_id
        });

        console.log(`✅ Created Vikunja task ${vikunjaTaskId} for issue in game ${gameId}`);
      } catch (vikunjaError) {
        console.error('❌ Failed to create Vikunja task:', vikunjaError);
        return NextResponse.json(
          { error: 'Failed to create Vikunja task for actionable issue' },
          { status: 500 }
        );
      }
    }

    // Create game_issues record
    const issue = await createIssue({
      gameId: gameId,
      reportedById: body.reportedById,
      issueCategory: body.issueCategory,
      issueType: issueType,
      description: body.issueDescription,
      vikunjaTaskId: vikunjaTaskId
    });

    // Award 100 point reporter bonus (async, non-blocking)
    awardPoints({
      staffId: body.reportedById,
      actionType: 'issue_report',
      metadata: {
        gameId: gameId
      },
      context: `Reported ${body.issueCategory.replace(/_/g, ' ')} issue for game ${gameId}`
    }).catch(err => {
      console.error('Failed to award issue report points:', err);
    });

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        gameId: issue.game_id,
        issueCategory: issue.issue_category,
        issueType: issue.issue_type,
        vikunjaTaskId: issue.vikunja_task_id,
        createdAt: issue.created_at
      },
      message: issueType === 'actionable'
        ? `Actionable issue reported and Vikunja task #${vikunjaTaskId} created. You earned 100 points!`
        : `Non-actionable issue reported for tracking. You earned 100 points!`
    });

  } catch (error) {
    console.error('❌ Error reporting issue:', error);
    return NextResponse.json(
      {
        error: 'Failed to report issue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
