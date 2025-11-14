/**
 * API Route: /api/roster/hours
 * Manage daily open/close hours for roster generation
 *
 * GET: Fetch all roster hours
 * PUT: Update roster hours for specific days
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export interface RosterHours {
  id: number;
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/roster/hours
 * Fetch all roster hours (7 days)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(`
      SELECT
        id,
        day_of_week,
        open_time::text as open_time,
        close_time::text as close_time,
        is_active,
        created_at,
        updated_at
      FROM roster_hours
      ORDER BY
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END
    `);

    return NextResponse.json({
      success: true,
      hours: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching roster hours:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roster hours', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roster/hours
 * Update roster hours for one or more days
 *
 * Body: {
 *   updates: [
 *     { day_of_week: 'Monday', open_time: '12:00', close_time: '00:00', is_active: true },
 *     ...
 *   ]
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const update of updates) {
        const { day_of_week, open_time, close_time, is_active } = update;

        // Validate day of week
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!validDays.includes(day_of_week)) {
          throw new Error(`Invalid day_of_week: ${day_of_week}`);
        }

        // Validate times (HH:MM format)
        const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(open_time) || !timeRegex.test(close_time)) {
          throw new Error(`Invalid time format for ${day_of_week}. Use HH:MM (00:00-23:59)`);
        }

        await client.query(`
          UPDATE roster_hours
          SET
            open_time = $1,
            close_time = $2,
            is_active = $3,
            updated_at = NOW()
          WHERE day_of_week = $4
        `, [open_time, close_time, is_active, day_of_week]);
      }

      await client.query('COMMIT');

      // Fetch updated hours
      const result = await client.query(`
        SELECT
          id,
          day_of_week,
          open_time::text as open_time,
          close_time::text as close_time,
          is_active,
          created_at,
          updated_at
        FROM roster_hours
        ORDER BY
          CASE day_of_week
            WHEN 'Monday' THEN 1
            WHEN 'Tuesday' THEN 2
            WHEN 'Wednesday' THEN 3
            WHEN 'Thursday' THEN 4
            WHEN 'Friday' THEN 5
            WHEN 'Saturday' THEN 6
            WHEN 'Sunday' THEN 7
          END
      `);

      return NextResponse.json({
        success: true,
        message: `Updated ${updates.length} day(s)`,
        hours: result.rows
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error updating roster hours:', error);
    return NextResponse.json(
      { error: 'Failed to update roster hours', details: error.message },
      { status: 500 }
    );
  }
}
