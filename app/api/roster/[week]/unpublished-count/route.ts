/**
 * Roster Unpublished Count API
 * GET /api/roster/[week]/unpublished-count - Get count of unpublished changes
 *
 * Phase 3.2: Draft/Publish workflow
 * Returns the count of shifts that are either:
 * - Not yet published (is_published = false)
 * - Edited after publish (edited_after_publish = true)
 *
 * Used to display "Publish (N)" button
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ week: string }> }
) {
  try {
    const { week } = await context.params;

    // Validate week format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return NextResponse.json(
        { error: 'Invalid week format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Get count of unpublished changes
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM roster_shifts
       WHERE roster_week_start = $1
       AND (is_published = false OR edited_after_publish = true)`,
      [week]
    );

    const count = parseInt(result.rows[0].count);

    // Check roster status
    const statusResult = await pool.query(
      'SELECT status FROM roster_metadata WHERE roster_week_start = $1',
      [week]
    );

    const status = statusResult.rows[0]?.status || 'draft';

    return NextResponse.json({
      success: true,
      week_start: week,
      unpublished_count: count,
      roster_status: status,
    });

  } catch (error) {
    console.error('Error getting unpublished count:', error);

    return NextResponse.json(
      {
        error: 'Failed to get unpublished count',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
