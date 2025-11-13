import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

/**
 * GET /api/roster/preferred-times
 * Fetch staff preferred shift times
 *
 * Query params:
 * - staff_id: Filter by specific staff member (optional)
 * - day_of_week: Filter by day (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staff_id');
    const dayOfWeek = searchParams.get('day_of_week');

    let query = `
      SELECT
        pt.id,
        pt.staff_id,
        sl.staff_name,
        sl.nickname as staff_nickname,
        pt.day_of_week,
        pt.hour_start,
        pt.hour_end,
        pt.created_at,
        pt.updated_at
      FROM staff_preferred_times pt
      JOIN staff_list sl ON pt.staff_id = sl.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (staffId) {
      query += ` AND pt.staff_id = $${paramIndex}`;
      params.push(staffId);
      paramIndex++;
    }

    if (dayOfWeek) {
      query += ` AND pt.day_of_week = $${paramIndex}`;
      params.push(dayOfWeek);
      paramIndex++;
    }

    query += ` ORDER BY pt.day_of_week, pt.hour_start`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      preferred_times: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching preferred times:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferred times' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/preferred-times
 * Create or update staff preferred times
 *
 * Body:
 * {
 *   staff_id: string,
 *   day_of_week: string,
 *   hour_start: number,
 *   hour_end: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, day_of_week, hour_start, hour_end } = body;

    // Validate required fields
    if (!staff_id || !day_of_week || hour_start === undefined || hour_end === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: staff_id, day_of_week, hour_start, hour_end' },
        { status: 400 }
      );
    }

    // Validate day_of_week
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day_of_week)) {
      return NextResponse.json(
        { error: 'Invalid day_of_week. Must be one of: ' + validDays.join(', ') },
        { status: 400 }
      );
    }

    // Validate hours
    if (hour_start < 0 || hour_start > 23 || hour_end < 0 || hour_end > 23) {
      return NextResponse.json(
        { error: 'Invalid hours. Must be between 0 and 23' },
        { status: 400 }
      );
    }

    // Insert preferred time
    const result = await pool.query(
      `INSERT INTO staff_preferred_times (staff_id, day_of_week, hour_start, hour_end)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [staff_id, day_of_week, hour_start, hour_end]
    );

    return NextResponse.json({
      preferred_time: result.rows[0],
      message: 'Preferred time created successfully',
    });
  } catch (error) {
    console.error('Error creating preferred time:', error);
    return NextResponse.json(
      { error: 'Failed to create preferred time' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roster/preferred-times
 * Delete a preferred time entry
 *
 * Body:
 * {
 *   id: number
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    await pool.query(
      'DELETE FROM staff_preferred_times WHERE id = $1',
      [id]
    );

    return NextResponse.json({
      message: 'Preferred time deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting preferred time:', error);
    return NextResponse.json(
      { error: 'Failed to delete preferred time' },
      { status: 500 }
    );
  }
}
