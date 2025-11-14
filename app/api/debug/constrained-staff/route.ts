/**
 * Debug API: Check availability for constrained staff members
 * GET /api/debug/constrained-staff
 */

import { NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        sl.staff_name,
        sl.nickname,
        sa.day_of_week,
        sa.hour_start,
        sa.hour_end,
        sa.availability_status
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      WHERE sl.nickname IN ('Long', 'Ivy', 'Nhi', 'Sơn', 'An', 'Vũ')
      ORDER BY sl.nickname,
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

    // Group by staff member
    const staffData: Record<string, any> = {};

    result.rows.forEach(row => {
      const nickname = row.nickname || row.staff_name;
      if (!staffData[nickname]) {
        staffData[nickname] = {
          name: row.staff_name,
          nickname: row.nickname,
          availability: [],
          totalAvailableHours: 0
        };
      }

      staffData[nickname].availability.push({
        day_of_week: row.day_of_week,
        hour_start: row.hour_start,
        hour_end: row.hour_end,
        availability_status: row.availability_status,
        hours: row.hour_end - row.hour_start
      });

      if (row.availability_status === 'available') {
        staffData[nickname].totalAvailableHours += (row.hour_end - row.hour_start);
      }
    });

    return NextResponse.json({
      success: true,
      staffData,
      count: Object.keys(staffData).length
    });

  } catch (error) {
    console.error('Error fetching constrained staff availability:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch constrained staff availability',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
