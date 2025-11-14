/**
 * Clock Record Approval API
 * POST /api/roster/clock-records/[id]/approve - Approve a clock record
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { approved_hours, approved_by, notes } = body;

    if (!approved_by) {
      return NextResponse.json(
        { error: 'approved_by (staff_id) is required' },
        { status: 400 }
      );
    }

    // Fetch the clock record
    const recordResult = await pool.query(
      'SELECT * FROM clock_records WHERE id = $1',
      [id]
    );

    if (recordResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Clock record not found' },
        { status: 404 }
      );
    }

    const record = recordResult.rows[0];

    // Calculate actual hours if not provided
    let hoursToApprove = approved_hours;
    if (!hoursToApprove && record.clock_in_time && record.clock_out_time) {
      const clockIn = new Date(record.clock_in_time);
      const clockOut = new Date(record.clock_out_time);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      hoursToApprove = diffMs / (1000 * 60 * 60);
    }

    // Update the clock record
    const result = await pool.query(
      `UPDATE clock_records
       SET requires_approval = false,
           approved_by = $1,
           approved_at = NOW(),
           approved_hours = $2,
           variance_reason = COALESCE($3, variance_reason)
       WHERE id = $4
       RETURNING *`,
      [approved_by, hoursToApprove, notes, id]
    );

    return NextResponse.json({
      success: true,
      record: result.rows[0],
      message: 'Clock record approved successfully',
    });

  } catch (error) {
    console.error('Error approving clock record:', error);

    return NextResponse.json(
      {
        error: 'Failed to approve clock record',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
