/**
 * Roster Shifts API
 * GET /api/roster/shifts - Fetch saved shifts for a specific week
 * POST /api/roster/shifts - Create a new shift
 *
 * For Phase 3.1, shifts are stored in-memory (ephemeral).
 * In future phases, this will persist to a dedicated `roster_shifts` table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rosterMemoryStore } from '@/lib/services/roster-memory-store';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const weekStart = searchParams.get('week_start');

    if (!weekStart) {
      return NextResponse.json(
        { error: 'week_start parameter required (format: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validate it's a Monday
    const date = new Date(weekStart + 'T00:00:00');
    if (date.getDay() !== 1) {
      return NextResponse.json(
        { error: 'week_start must be a Monday' },
        { status: 400 }
      );
    }

    // Phase 3.2: Fetch shifts from database
    const { default: pool } = await import('@/lib/db/postgres');

    // First check if roster exists in database
    const rosterCheck = await pool.query(
      'SELECT id, status FROM roster_metadata WHERE roster_week_start = $1',
      [weekStart]
    );

    // If no roster exists, generate and save one
    if (rosterCheck.rows.length === 0) {
      console.log(`[Roster Shifts] No roster found for ${weekStart}, generating and saving...`);

      const generateResponse = await fetch(
        `${request.nextUrl.origin}/api/roster/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            week_start: weekStart,
            use_default_requirements: true,
            auto_save: true, // ✅ Save to database with proper UUIDs
          }),
        }
      );

      if (!generateResponse.ok) {
        throw new Error('Failed to generate roster');
      }

      const rosterData = await generateResponse.json();
      console.log(`[Roster Shifts] Generated and saved roster (${rosterData.saved ? 'saved' : 'not saved'})`);

      // Now fetch the saved shifts from database with proper UUIDs
      const shiftsResult = await pool.query(
        `SELECT
          rs.*,
          sl.staff_name,
          sl.nickname
         FROM roster_shifts rs
         LEFT JOIN staff_list sl ON rs.staff_id = sl.id
         WHERE rs.roster_week_start = $1
         ORDER BY
           CASE rs.day_of_week
             WHEN 'Monday' THEN 1
             WHEN 'Tuesday' THEN 2
             WHEN 'Wednesday' THEN 3
             WHEN 'Thursday' THEN 4
             WHEN 'Friday' THEN 5
             WHEN 'Saturday' THEN 6
             WHEN 'Sunday' THEN 7
           END,
           rs.scheduled_start`,
        [weekStart]
      );

      const shifts = shiftsResult.rows.map((row: any) => ({
        id: row.id,
        staff_id: row.staff_id,
        staff_name: row.nickname || row.staff_name,
        day_of_week: row.day_of_week,
        scheduled_start: row.scheduled_start,
        scheduled_end: row.scheduled_end,
        role_required: row.role_required,
        shift_type: row.shift_type,
        is_published: row.is_published,
        published_at: row.published_at,
        edited_after_publish: row.edited_after_publish,
        has_violation: false, // TODO: Calculate violations
      }));

      return NextResponse.json({
        success: true,
        week_start: weekStart,
        shifts,
        metadata: {
          total_shifts: shifts.length,
          staff_count: new Set(shifts.map((s: any) => s.staff_id)).size,
          generated_at: new Date().toISOString(),
          source: 'generated-and-saved',
          roster_status: 'draft',
        },
      });
    }

    // Roster exists - fetch shifts from database
    const shiftsResult = await pool.query(
      `SELECT
        rs.*,
        sl.staff_name,
        sl.nickname
       FROM roster_shifts rs
       LEFT JOIN staff_list sl ON rs.staff_id = sl.id
       WHERE rs.roster_week_start = $1
       ORDER BY
         CASE rs.day_of_week
           WHEN 'Monday' THEN 1
           WHEN 'Tuesday' THEN 2
           WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4
           WHEN 'Friday' THEN 5
           WHEN 'Saturday' THEN 6
           WHEN 'Sunday' THEN 7
         END,
         rs.scheduled_start`,
      [weekStart]
    );

    const shifts = shiftsResult.rows.map((row: any) => ({
      id: row.id,
      staff_id: row.staff_id,
      staff_name: row.nickname || row.staff_name,
      day_of_week: row.day_of_week,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      role_required: row.role_required,
      shift_type: row.shift_type,
      is_published: row.is_published,
      published_at: row.published_at,
      edited_after_publish: row.edited_after_publish,
      has_violation: false, // TODO: Calculate violations
    }));

    return NextResponse.json({
      success: true,
      week_start: weekStart,
      shifts,
      metadata: {
        total_shifts: shifts.length,
        staff_count: new Set(shifts.map((s: any) => s.staff_id)).size,
        generated_at: new Date().toISOString(),
        source: 'database',
        roster_status: rosterCheck.rows[0].status,
      },
    });

  } catch (error) {
    console.error('Error fetching roster shifts:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch roster shifts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, scheduled_start, scheduled_end, role_required, week_start, day_of_week, shift_type } = body;

    // Validate required fields
    if (!staff_id || !scheduled_start || !scheduled_end || !role_required || !week_start || !day_of_week) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { default: pool } = await import('@/lib/db/postgres');

    // Check if roster is published
    const rosterCheck = await pool.query(
      'SELECT id, status FROM roster_metadata WHERE roster_week_start = $1',
      [week_start]
    );

    const isPublishedRoster = rosterCheck.rows.length > 0 && rosterCheck.rows[0].status === 'published';

    // Insert shift into database
    const result = await pool.query(
      `INSERT INTO roster_shifts (
        staff_id,
        roster_week_start,
        day_of_week,
        scheduled_start,
        scheduled_end,
        role_required,
        shift_type,
        is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        staff_id,
        week_start,
        day_of_week,
        scheduled_start,
        scheduled_end,
        role_required,
        shift_type || 'day',
        false, // New shifts are always unpublished initially
      ]
    );

    const newShift = result.rows[0];

    console.log(`[Roster Shifts] Created new shift ${newShift.id} for ${staff_id} on ${day_of_week}${isPublishedRoster ? ' (unpublished change to published roster)' : ''}`);

    return NextResponse.json({
      success: true,
      shift: {
        ...newShift,
        edited_after_publish: false,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating roster shift:', error);

    return NextResponse.json(
      {
        error: 'Failed to create roster shift',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
