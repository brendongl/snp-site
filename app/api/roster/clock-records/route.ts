/**
 * Clock Records API
 * GET /api/roster/clock-records - Fetch clock-in/out records with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staff_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const requiresApproval = searchParams.get('requires_approval');
    const missingClockOut = searchParams.get('missing_clock_out') === 'true';

    // Build WHERE clauses
    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (staffId) {
      whereClauses.push(`cr.staff_id = $${paramIndex}`);
      params.push(staffId);
      paramIndex++;
    }

    if (startDate) {
      whereClauses.push(`DATE(cr.clock_in_time) >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClauses.push(`DATE(cr.clock_in_time) <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    if (requiresApproval !== null) {
      whereClauses.push(`cr.requires_approval = $${paramIndex}`);
      params.push(requiresApproval === 'true');
      paramIndex++;
    }

    if (missingClockOut) {
      whereClauses.push(`cr.clock_out_time IS NULL`);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Fetch clock records with staff and shift info
    const query = `
      SELECT
        cr.*,
        sl.staff_name,
        sl.nickname,
        rs.scheduled_start,
        rs.scheduled_end,
        rs.day_of_week,
        approver.staff_name as approved_by_name
      FROM clock_records cr
      JOIN staff_list sl ON cr.staff_id = sl.id
      LEFT JOIN roster_shifts rs ON cr.shift_id = rs.id
      LEFT JOIN staff_list approver ON cr.approved_by = approver.id
      ${whereClause}
      ORDER BY cr.clock_in_time DESC
      LIMIT 100
    `;

    const result = await pool.query(query, params);

    const records = result.rows.map((row: any) => {
      const clockIn = new Date(row.clock_in_time);
      const clockOut = row.clock_out_time ? new Date(row.clock_out_time) : null;

      // Calculate actual hours
      let actualHours = null;
      if (clockOut) {
        const diffMs = clockOut.getTime() - clockIn.getTime();
        actualHours = diffMs / (1000 * 60 * 60); // Convert to hours
      }

      // Calculate rostered hours
      let rosteredHours = null;
      if (row.rostered_start && row.rostered_end) {
        const [startHour, startMin] = row.rostered_start.split(':').map(Number);
        const [endHour, endMin] = row.rostered_end.split(':').map(Number);
        const start = startHour + startMin / 60;
        const end = endHour + endMin / 60;
        rosteredHours = end < start ? (end + 24) - start : end - start;
      }

      // Calculate variance
      let varianceHours = null;
      if (actualHours !== null && rosteredHours !== null) {
        varianceHours = actualHours - rosteredHours;
      }

      return {
        id: row.id,
        staff_id: row.staff_id,
        staff_name: row.nickname || row.staff_name,
        shift_id: row.shift_id,
        clock_in_time: row.clock_in_time,
        clock_out_time: row.clock_out_time,
        clock_in_location: row.clock_in_location,
        clock_out_location: row.clock_out_location,
        rostered_start: row.rostered_start,
        rostered_end: row.rostered_end,
        day_of_week: row.day_of_week,
        variance_reason: row.variance_reason,
        requires_approval: row.requires_approval,
        approved_by: row.approved_by,
        approved_by_name: row.approved_by_name,
        approved_at: row.approved_at,
        approved_hours: row.approved_hours,
        points_awarded: row.points_awarded,
        created_at: row.created_at,
        // Calculated fields
        actual_hours: actualHours,
        rostered_hours: rosteredHours,
        variance_hours: varianceHours,
      };
    });

    return NextResponse.json({
      success: true,
      records,
      metadata: {
        total_records: records.length,
        filters_applied: {
          staff_id: staffId,
          start_date: startDate,
          end_date: endDate,
          requires_approval: requiresApproval,
          missing_clock_out: missingClockOut,
        },
      },
    });

  } catch (error) {
    console.error('Error fetching clock records:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch clock records',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
