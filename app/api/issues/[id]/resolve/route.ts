/**
 * POST /api/issues/[id]/resolve
 *
 * Resolve an issue and award resolution points
 * - Marks issue as resolved in database
 * - Completes associated Vikunja task (if actionable)
 * - Awards resolution points based on category and game complexity
 * v1.6.1: Now adds completion comment to Vikunja tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getIssueById, resolveIssue } from '@/lib/services/issues-db-service';
import { completeTask } from '@/lib/services/vikunja-service';
import { awardPoints } from '@/lib/services/points-service';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

interface ResolveIssueRequest {
  resolvedById: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: issueId } = await params;
    const body: ResolveIssueRequest = await request.json();

    // Validate input
    if (!body.resolvedById) {
      return NextResponse.json(
        { error: 'Missing required field: resolvedById' },
        { status: 400 }
      );
    }

    // Fetch issue details
    const issue = await getIssueById(issueId);

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    if (issue.resolved_at) {
      return NextResponse.json(
        { error: 'Issue already resolved' },
        { status: 400 }
      );
    }

    // Mark Vikunja task as complete (if actionable issue with task)
    // v1.6.1: Now includes staff name for completion comment
    if (issue.vikunja_task_id) {
      try {
        // Get staff name for completion comment
        const client = await pool.connect();
        let staffName: string | undefined;

        try {
          const result = await client.query(
            `SELECT staff_name as name FROM staff_list WHERE id = $1`,
            [body.resolvedById]
          );

          if (result.rows.length > 0) {
            staffName = result.rows[0].name;
          }
        } finally {
          client.release();
        }

        await completeTask(issue.vikunja_task_id, staffName);
        console.log(`✅ Completed Vikunja task ${issue.vikunja_task_id}`);
      } catch (vikunjaError) {
        console.error('❌ Failed to complete Vikunja task:', vikunjaError);
        // Continue anyway - we'll mark issue as resolved even if Vikunja fails
      }
    }

    // Resolve issue in database
    const resolvedIssue = await resolveIssue(issueId, body.resolvedById);

    // Award resolution points (if actionable)
    if (issue.issue_type === 'actionable') {
      // TypeScript assertion - we know game_complexity exists from JOIN
      const gameComplexity = (issue as any).game_complexity || 1;

      awardPoints({
        staffId: body.resolvedById,
        actionType: 'issue_resolution',
        metadata: {
          gameId: issue.game_id,
          gameComplexity: gameComplexity,
          issueCategory: issue.issue_category
        },
        context: `Resolved ${issue.issue_category.replace(/_/g, ' ')} issue for game ${issue.game_id}`
      }).catch(err => {
        console.error('Failed to award issue resolution points:', err);
      });
    }

    return NextResponse.json({
      success: true,
      issue: {
        id: resolvedIssue.id,
        gameId: resolvedIssue.game_id,
        issueCategory: resolvedIssue.issue_category,
        issueType: resolvedIssue.issue_type,
        resolvedAt: resolvedIssue.resolved_at,
        resolvedById: resolvedIssue.resolved_by_id
      },
      message: issue.issue_type === 'actionable'
        ? `Issue resolved! You earned points for resolving this ${issue.issue_category.replace(/_/g, ' ')} issue.`
        : `Non-actionable issue marked as resolved.`
    });

  } catch (error) {
    console.error('❌ Error resolving issue:', error);
    return NextResponse.json(
      {
        error: 'Failed to resolve issue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
