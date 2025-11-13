/**
 * Roster Publish API
 * POST /api/roster/[week]/publish - Publish a draft roster
 *
 * Phase 3.2: Draft/Publish workflow
 * - Marks roster as published
 * - Sets all shifts to published
 * - Clears edited_after_publish flags
 * - Returns warnings if violations exist
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ week: string }> }
) {
  const client = await pool.connect();

  try {
    const { week } = await context.params;
    const body = await request.json();
    const { published_by } = body; // Staff ID of admin publishing

    // Validate week format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return NextResponse.json(
        { error: 'Invalid week format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validate it's a Monday
    const date = new Date(week + 'T00:00:00');
    if (date.getDay() !== 1) {
      return NextResponse.json(
        { error: 'Week start must be a Monday' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    // Check if roster exists
    const rosterCheck = await client.query(
      'SELECT id, status FROM roster_metadata WHERE roster_week_start = $1',
      [week]
    );

    if (rosterCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'No roster found for this week. Generate a roster first.' },
        { status: 404 }
      );
    }

    const rosterId = rosterCheck.rows[0].id;

    // Get count of unpublished changes
    const unpublishedCount = await client.query(
      `SELECT COUNT(*) as count
       FROM roster_shifts
       WHERE roster_week_start = $1
       AND (is_published = false OR edited_after_publish = true)`,
      [week]
    );

    const changesCount = parseInt(unpublishedCount.rows[0].count);

    // Check for violations (if roster_metadata has violations field)
    const violationsCheck = await client.query(
      'SELECT violations FROM roster_metadata WHERE id = $1',
      [rosterId]
    );

    const violations = violationsCheck.rows[0]?.violations || [];

    // Update roster_metadata to published
    await client.query(
      `UPDATE roster_metadata
       SET status = 'published',
           published_at = NOW(),
           published_by = $1
       WHERE id = $2`,
      [published_by, rosterId]
    );

    // Update all shifts to published
    await client.query(
      `UPDATE roster_shifts
       SET is_published = true,
           published_at = NOW(),
           edited_after_publish = false
       WHERE roster_week_start = $1`,
      [week]
    );

    await client.query('COMMIT');

    console.log(`[Roster Publish] Published roster for week ${week} (${changesCount} changes)`);

    return NextResponse.json({
      success: true,
      message: `Roster published successfully`,
      week_start: week,
      changes_published: changesCount,
      violations: violations.length > 0 ? violations : null,
      published_at: new Date().toISOString(),
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error publishing roster:', error);

    return NextResponse.json(
      {
        error: 'Failed to publish roster',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
