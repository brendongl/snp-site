/**
 * GET /api/games/[id]/issues
 *
 * Fetch all issues (resolved and unresolved) for a specific game
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllIssuesByGameId } from '@/lib/services/issues-db-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;

    // Fetch all issues for this game
    const issues = await getAllIssuesByGameId(gameId);

    return NextResponse.json({
      success: true,
      count: issues.length,
      issues: issues.map(issue => ({
        id: issue.id,
        gameId: issue.game_id,
        gameName: issue.game_name,
        reportedById: issue.reported_by_id,
        reporterName: issue.reporter_name,
        issueCategory: issue.issue_category,
        issueType: issue.issue_type,
        description: issue.description,
        vikunjaTaskId: issue.vikunja_task_id,
        resolvedAt: issue.resolved_at,
        resolvedById: issue.resolved_by_id,
        resolverName: issue.resolver_name,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching issues for game:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
