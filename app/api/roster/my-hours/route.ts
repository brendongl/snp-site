/**
 * Staff Hours Summary API
 * GET /api/roster/my-hours - Fetch hours summary for logged-in staff
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staff_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!staffId) {
      return NextResponse.json(
        { error: 'staff_id is required' },
        { status: 400 }
      );
    }

    // Build date filter
    const dateFilters: string[] = [];
    const params: any[] = [staffId];
    let paramIndex = 2;

    if (startDate) {
      dateFilters.push(`DATE(cr.clock_in_time) >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      dateFilters.push(`DATE(cr.clock_in_time) <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const dateFilter = dateFilters.length > 0
      ? `AND ${dateFilters.join(' AND ')}`
      : '';

    // Fetch clock records with pay calculation
    const recordsQuery = `
      SELECT
        cr.*,
        rs.scheduled_start,
        rs.scheduled_end,
        rs.day_of_week,
        sl.base_hourly_rate,
        sl.weekend_multiplier,
        sl.holiday_multiplier,
        sl.overtime_multiplier
      FROM clock_records cr
      JOIN staff_list sl ON cr.staff_id = sl.id
      LEFT JOIN roster_shifts rs ON cr.shift_id = rs.id
      WHERE cr.staff_id = $1
        ${dateFilter}
        AND cr.approved_by IS NOT NULL
      ORDER BY cr.clock_in_time DESC
    `;

    const result = await pool.query(recordsQuery, params);

    // Calculate totals and pay breakdown
    let totalHours = 0;
    let totalBasePay = 0;
    let totalWeekendPay = 0;
    let totalHolidayPay = 0;
    let totalOvertimePay = 0;
    let totalPoints = 0;

    const records = result.rows.map((row: any) => {
      const clockIn = new Date(row.clock_in_time);
      const clockOut = row.clock_out_time ? new Date(row.clock_out_time) : null;

      // Use approved hours or calculate from clock times
      const hours = row.approved_hours || (clockOut ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) : 0);

      totalHours += hours;
      totalPoints += row.points_awarded || 0;

      // Determine pay multiplier
      const dayOfWeek = row.day_of_week || format(clockIn, 'EEEE');
      const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
      const isHoliday = false; // TODO: Check against holidays table
      const isOvertime = hours > 8;

      let pay = hours * (row.base_hourly_rate || 0);
      let multiplier = 1.0;
      let payCategory = 'base';

      if (isHoliday) {
        multiplier = row.holiday_multiplier || 1.0;
        payCategory = 'holiday';
        totalHolidayPay += pay * multiplier;
      } else if (isWeekend) {
        multiplier = row.weekend_multiplier || 1.0;
        payCategory = 'weekend';
        totalWeekendPay += pay * multiplier;
      } else if (isOvertime) {
        const regularHours = 8;
        const overtimeHours = hours - regularHours;
        const regularPay = regularHours * row.base_hourly_rate;
        const overtimePay = overtimeHours * row.base_hourly_rate * (row.overtime_multiplier || 1.5);
        totalBasePay += regularPay;
        totalOvertimePay += overtimePay;
        pay = regularPay + overtimePay;
        payCategory = 'overtime';
      } else {
        totalBasePay += pay;
      }

      return {
        id: row.id,
        clock_in_time: row.clock_in_time,
        clock_out_time: row.clock_out_time,
        day_of_week: dayOfWeek,
        approved_hours: hours,
        base_rate: row.base_hourly_rate,
        pay_multiplier: multiplier,
        pay_category: payCategory,
        total_pay: pay * multiplier,
        points_awarded: row.points_awarded || 0,
      };
    });

    return NextResponse.json({
      success: true,
      records,
      summary: {
        total_hours: totalHours,
        total_pay: totalBasePay + totalWeekendPay + totalHolidayPay + totalOvertimePay,
        pay_breakdown: {
          base: totalBasePay,
          weekend: totalWeekendPay,
          holiday: totalHolidayPay,
          overtime: totalOvertimePay,
        },
        total_points: totalPoints,
      },
      metadata: {
        staff_id: staffId,
        start_date: startDate,
        end_date: endDate,
        record_count: records.length,
      },
    });

  } catch (error) {
    console.error('Error fetching staff hours:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch staff hours',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper to format date (simplified, would use date-fns in real code)
function format(date: Date, formatStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (formatStr === 'EEEE') {
    return days[date.getDay()];
  }
  return date.toISOString();
}
