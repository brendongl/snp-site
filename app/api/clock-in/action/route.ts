/**
 * Clock In/Out Action API
 * POST /api/clock-in/action - Clock in or out
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, action, location_token, geolocation } = body;

    if (!staff_id || !action) {
      return NextResponse.json(
        { error: 'staff_id and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'clock-in' && action !== 'clock-out') {
      return NextResponse.json(
        { error: 'action must be "clock-in" or "clock-out"' },
        { status: 400 }
      );
    }

    // Decode location token if provided
    let locationData = null;
    if (location_token) {
      try {
        const decoded = Buffer.from(location_token, 'base64').toString('utf-8');
        locationData = JSON.parse(decoded);
      } catch (err) {
        console.error('Invalid location token:', err);
      }
    }

    if (action === 'clock-in') {
      // Check for existing active clock-in
      const existingResult = await pool.query(
        'SELECT id FROM clock_records WHERE staff_id = $1 AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1',
        [staff_id]
      );

      if (existingResult.rows.length > 0) {
        return NextResponse.json(
          {
            error: 'Already clocked in',
            message: 'You already have an active clock-in. Please clock out first.',
            existing_record_id: existingResult.rows[0].id
          },
          { status: 400 }
        );
      }

      // Find matching roster shift for today
      const today = new Date();
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Get Monday
      const weekStartStr = weekStart.toISOString().split('T')[0];

      const shiftResult = await pool.query(
        `SELECT id, scheduled_start, scheduled_end
         FROM roster_shifts
         WHERE staff_id = $1
           AND day_of_week = $2
           AND roster_week_start = $3
           AND is_published = true
         LIMIT 1`,
        [staff_id, dayOfWeek, weekStartStr]
      );

      const shift = shiftResult.rows[0] || null;

      // Calculate points based on punctuality (if shift exists)
      let pointsAwarded = 0;
      let varianceReason = null;
      let requiresApproval = false;

      if (shift) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
        const [schedStartHour, schedStartMin] = shift.scheduled_start.split(':').map(Number);
        const scheduledTime = schedStartHour * 60 + schedStartMin;
        const minutesDiff = currentTime - scheduledTime;

        if (minutesDiff <= -5) {
          // Early (5+ minutes before scheduled)
          pointsAwarded = 50;
        } else if (minutesDiff <= 5) {
          // On time (within 5 minutes)
          pointsAwarded = 20;
        } else if (minutesDiff <= 15) {
          // Late but acceptable (5-15 minutes)
          pointsAwarded = 0;
          varianceReason = `Clocked in ${minutesDiff} minutes late`;
        } else {
          // Very late (15+ minutes)
          pointsAwarded = 0;
          varianceReason = `Clocked in ${minutesDiff} minutes late`;
          requiresApproval = true;
        }
      } else {
        // Unscheduled shift
        varianceReason = 'Unscheduled clock-in';
        requiresApproval = true;
      }

      // Insert clock record
      const result = await pool.query(
        `INSERT INTO clock_records (
          staff_id,
          shift_id,
          clock_in_time,
          clock_in_location,
          rostered_start,
          rostered_end,
          variance_reason,
          requires_approval,
          points_awarded
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          staff_id,
          shift?.id || null,
          geolocation ? JSON.stringify(geolocation) : null,
          shift?.scheduled_start || null,
          shift?.scheduled_end || null,
          varianceReason,
          requiresApproval,
          pointsAwarded
        ]
      );

      return NextResponse.json({
        success: true,
        action: 'clock-in',
        record: result.rows[0],
        points_awarded: pointsAwarded,
        message: `Clocked in successfully! ${pointsAwarded > 0 ? `+${pointsAwarded} points` : ''}`,
        location: locationData?.location_name || 'Unknown',
      });

    } else {
      // Clock out
      const activeResult = await pool.query(
        'SELECT * FROM clock_records WHERE staff_id = $1 AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1',
        [staff_id]
      );

      if (activeResult.rows.length === 0) {
        return NextResponse.json(
          {
            error: 'No active clock-in',
            message: 'You are not currently clocked in. Please clock in first.'
          },
          { status: 400 }
        );
      }

      const activeRecord = activeResult.rows[0];

      // Check if clock-out is late (>1 hour after rostered end)
      let requiresApproval = activeRecord.requires_approval; // Preserve existing approval flag
      if (activeRecord.rostered_end) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [rosteredHour, rosteredMin] = activeRecord.rostered_end.split(':').map(Number);
        const rosteredEndTime = rosteredHour * 60 + rosteredMin;
        const minutesDiff = currentTime - rosteredEndTime;

        if (Math.abs(minutesDiff) > 60) {
          requiresApproval = true;
        }
      }

      // Update clock record with clock-out
      const result = await pool.query(
        `UPDATE clock_records
         SET clock_out_time = NOW(),
             clock_out_location = $1,
             requires_approval = $2
         WHERE id = $3
         RETURNING *`,
        [
          geolocation ? JSON.stringify(geolocation) : null,
          requiresApproval,
          activeRecord.id
        ]
      );

      return NextResponse.json({
        success: true,
        action: 'clock-out',
        record: result.rows[0],
        message: 'Clocked out successfully!',
        location: locationData?.location_name || 'Unknown',
      });
    }

  } catch (error) {
    console.error('Error processing clock action:', error);

    return NextResponse.json(
      {
        error: 'Failed to process clock action',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
