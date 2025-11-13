/**
 * Staff Availability API
 * GET /api/roster/availability?week_start=YYYY-MM-DD
 *
 * Returns both:
 * - Weekly recurring availability (from staff_availability table)
 * - One-time time-off days (from staff_time_off table)
 *
 * Used by roster calendar to display Homebase-style availability
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';
import { addDays, format, startOfWeek } from 'date-fns';

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

    // Fetch weekly recurring availability for all staff
    const weeklyAvail = await pool.query(`
      SELECT
        sa.staff_id,
        sl.staff_name,
        sl.nickname,
        sa.day_of_week,
        sa.hour_start,
        sa.hour_end,
        sa.availability_status
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      ORDER BY sl.staff_name,
        CASE sa.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        sa.hour_start
    `);

    // Calculate week end date
    const weekStartDate = new Date(weekStart + 'T00:00:00');
    const weekEndDate = addDays(weekStartDate, 6);
    const weekEnd = format(weekEndDate, 'yyyy-MM-dd');

    // Fetch one-time time-off for this specific week
    const timeOff = await pool.query(`
      SELECT
        sto.staff_id,
        sl.staff_name,
        sl.nickname,
        sto.date,
        sto.time_start,
        sto.time_end,
        sto.reason
      FROM staff_time_off sto
      JOIN staff_list sl ON sto.staff_id = sl.id
      WHERE sto.date >= $1 AND sto.date <= $2
      ORDER BY sto.date, sl.staff_name
    `, [weekStart, weekEnd]);

    // Group by staff
    const availabilityByStaff: Record<string, any> = {};

    // Add weekly recurring availability
    weeklyAvail.rows.forEach((row: any) => {
      if (!availabilityByStaff[row.staff_id]) {
        availabilityByStaff[row.staff_id] = {
          staff_id: row.staff_id,
          staff_name: row.nickname || row.staff_name,
          weekly_availability: [],
          time_off: [],
        };
      }

      availabilityByStaff[row.staff_id].weekly_availability.push({
        day_of_week: row.day_of_week,
        hour_start: row.hour_start,
        hour_end: row.hour_end,
        status: row.availability_status,
      });
    });

    // Add one-time time-off
    timeOff.rows.forEach((row: any) => {
      if (!availabilityByStaff[row.staff_id]) {
        availabilityByStaff[row.staff_id] = {
          staff_id: row.staff_id,
          staff_name: row.nickname || row.staff_name,
          weekly_availability: [],
          time_off: [],
        };
      }

      availabilityByStaff[row.staff_id].time_off.push({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        time_start: row.time_start,
        time_end: row.time_end,
        reason: row.reason,
      });
    });

    return NextResponse.json({
      success: true,
      week_start: weekStart,
      week_end: weekEnd,
      availability: Object.values(availabilityByStaff),
    });

  } catch (error) {
    console.error('Error fetching availability:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch availability',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
