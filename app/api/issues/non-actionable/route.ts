/**
 * GET /api/issues/non-actionable
 *
 * Fetch all unresolved non-actionable issues
 * Used by BG Issues & Checks page to display tracking-only observations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllNonActionableIssues } from '@/lib/services/issues-db-service';

export async function GET(request: NextRequest) {
  try {
    // Fetch all non-actionable issues with enriched data
    const issues = await getAllNonActionableIssues();

    return NextResponse.json({
      success: true,
      count: issues.length,
      issues: issues.map(issue => ({
        id: issue.id,
        gameId: issue.game_id,
        gameName: issue.game_name || 'Unknown Game',
        reportedById: issue.reported_by_id,
        reporterName: issue.reporter_name || 'Unknown',
        issueCategory: issue.issue_category,
        description: issue.description,
        vikunjaTaskId: issue.vikunja_task_id,
        createdAt: issue.created_at,
        // Calculate days since reported for UI display
        daysAgo: Math.floor((Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24))
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
