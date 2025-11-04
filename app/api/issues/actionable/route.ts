/**
 * GET /api/issues/actionable
 *
 * Fetch all unresolved actionable issues with Vikunja task IDs
 * Used for admin overview of pending tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllActionableIssues } from '@/lib/services/issues-db-service';

export async function GET(request: NextRequest) {
  try {
    // Fetch all actionable issues
    const issues = await getAllActionableIssues();

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
        vikunjaTaskId: issue.vikunja_task_id,
        createdAt: issue.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching actionable issues:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch actionable issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
