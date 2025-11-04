/**
 * GET /api/issues/non-actionable
 *
 * Fetch all unresolved non-actionable issues
 * These are tracked for awareness but don't create Vikunja tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllNonActionableIssues } from '@/lib/services/issues-db-service';

export async function GET(request: NextRequest) {
  try {
    // Fetch all non-actionable issues
    const issues = await getAllNonActionableIssues();

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
        description: issue.description,
        createdAt: issue.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching non-actionable issues:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch non-actionable issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
