/**
 * API Route: /api/clock-in
 * Version: 2.0.0
 * Phase 1: Core API
 *
 * POST: Clock in or clock out
 * GET: Get current clock status for a staff member
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterDbService from '@/lib/services/roster-db-service';
import type { ClockInRequest, ClockOutRequest, ClockInResponse } from '@/types';

/**
 * Calculate variance in minutes between actual and scheduled time
 */
function calculateVariance(actualTime: Date, scheduledTime: string | null): number {
  if (!scheduledTime) return 0;

  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const scheduled = new Date(actualTime);
  scheduled.setHours(hours, minutes, 0, 0);

  const diffMs = actualTime.getTime() - scheduled.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Calculate points based on clock-in variance
 */
function calculateClockInPoints(varianceMinutes: number, isRepeatOffender: boolean): number {
  if (varianceMinutes >= -15 && varianceMinutes <= -5) {
    return 50; // Early 5-15 min
  } else if (varianceMinutes >= -5 && varianceMinutes <= 5) {
    return 20; // On-time
  } else if (varianceMinutes > 5 && varianceMinutes <= 15) {
    return isRepeatOffender ? -50 : 0; // Late 5-15 min (warning first time)
  } else if (varianceMinutes > 15) {
    return -100; // Late 15+ min
  }
  return 0;
}

/**
 * GET /api/clock-in?staff_id=xxx
 * Get current clock status for a staff member
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staff_id');

    if (!staffId) {
      return NextResponse.json(
        { error: 'staff_id is required' },
        { status: 400 }
      );
    }

    // Check for active clock-in
    const activeClockIn = await RosterDbService.getActiveClockIn(staffId);

    // Get upcoming shift for today
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const shifts = await RosterDbService.getShiftsByStaffId(staffId, todayStr, todayStr);

    return NextResponse.json({
      isClockedIn: !!activeClockIn,
      activeClockRecord: activeClockIn,
      upcomingShift: shifts[0] || null
    });
  } catch (error: any) {
    console.error('Error getting clock status:', error);
    return NextResponse.json(
      { error: 'Failed to get clock status', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clock-in
 * Clock in or clock out
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, staff_id, location, reason, actual_end_time } = body;

    if (!staff_id) {
      return NextResponse.json(
        { error: 'staff_id is required' },
        { status: 400 }
      );
    }

    if (action !== 'clock_in' && action !== 'clock_out') {
      return NextResponse.json(
        { error: 'action must be "clock_in" or "clock_out"' },
        { status: 400 }
      );
    }

    // ========================================
    // CLOCK IN
    // ========================================
    if (action === 'clock_in') {
      // Check if already clocked in
      const existingClockIn = await RosterDbService.getActiveClockIn(staff_id);
      if (existingClockIn) {
        return NextResponse.json(
          { error: 'Already clocked in', clockRecord: existingClockIn },
          { status: 400 }
        );
      }

      // Get scheduled shift for today
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const shifts = await RosterDbService.getShiftsByStaffId(staff_id, today, today);
      const scheduledShift = shifts[0] || null;

      // Calculate variance
      const varianceMinutes = scheduledShift
        ? calculateVariance(now, scheduledShift.scheduled_start)
        : 0;

      // Check for recent late clock-ins (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentRecords = await RosterDbService.getClockRecordsByStaffId(
        staff_id,
        thirtyDaysAgo.toISOString(),
        now.toISOString()
      );
      const recentLateCount = recentRecords.filter(r => {
        if (!r.rostered_start) return false;
        const variance = calculateVariance(new Date(r.clock_in_time), r.rostered_start);
        return variance > 5;
      }).length;

      const isRepeatOffender = recentLateCount > 0;
      const pointsAwarded = calculateClockInPoints(varianceMinutes, isRepeatOffender);

      // Create clock-in record
      const clockRecord = await RosterDbService.createClockIn(
        staff_id,
        scheduledShift?.id || null,
        location || null,
        scheduledShift?.scheduled_start || null,
        scheduledShift?.scheduled_end || null,
        pointsAwarded
      );

      // Update staff points
      if (pointsAwarded !== 0) {
        await RosterDbService.updateStaffRosteringInfo(staff_id, {});
        // TODO: Update points in staff_list table
      }

      // Determine prompt type
      let promptType: 'on_time' | 'early' | 'late_warning' | 'late_explanation_required' = 'on_time';
      if (varianceMinutes < -5) {
        promptType = 'early';
      } else if (varianceMinutes > 15) {
        promptType = 'late_explanation_required';
      } else if (varianceMinutes > 5) {
        promptType = 'late_warning';
      }

      // TODO: Fetch reminders (Vikunja tasks, store notices, shift notes)
      const reminders: any[] = [];

      const response: ClockInResponse = {
        success: true,
        clock_record: clockRecord,
        variance_minutes: varianceMinutes,
        points_awarded: pointsAwarded,
        reminders,
        prompt: {
          type: promptType,
          message: generateClockInMessage(promptType, varianceMinutes, pointsAwarded)
        }
      };

      return NextResponse.json(response);
    }

    // ========================================
    // CLOCK OUT
    // ========================================
    if (action === 'clock_out') {
      // Check if clocked in
      const activeClockIn = await RosterDbService.getActiveClockIn(staff_id);
      if (!activeClockIn) {
        return NextResponse.json(
          { error: 'Not clocked in' },
          { status: 400 }
        );
      }

      // Calculate variance
      const now = new Date();
      const varianceMinutes = activeClockIn.rostered_end
        ? calculateVariance(now, activeClockIn.rostered_end)
        : 0;

      // Determine if requires approval (15+ min variance)
      const requiresApproval = Math.abs(varianceMinutes) > 15;

      // Calculate clock-out points
      let clockOutPoints = 0;
      if (Math.abs(varianceMinutes) <= 5) {
        clockOutPoints = 20; // On-time clock-out
      }

      // Update clock-out
      const updatedRecord = await RosterDbService.updateClockOut(
        activeClockIn.id,
        location || null,
        reason || null,
        requiresApproval,
        clockOutPoints
      );

      return NextResponse.json({
        success: true,
        clock_record: updatedRecord,
        variance_minutes: varianceMinutes,
        points_awarded: clockOutPoints,
        requires_approval: requiresApproval
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error processing clock in/out:', error);
    return NextResponse.json(
      { error: 'Failed to process clock in/out', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Generate clock-in message based on prompt type
 */
function generateClockInMessage(type: string, variance: number, points: number): string {
  switch (type) {
    case 'early':
      return `Clocked in early (${Math.abs(variance)} min early). +${points} points!`;
    case 'on_time':
      return `Clocked in successfully! +${points} points for on-time arrival.`;
    case 'late_warning':
      return `Running late (${variance} min). This has been noted. Please try to arrive on time.`;
    case 'late_explanation_required':
      return `Late arrival (${variance} min). ${points} points. Please explain why you were late.`;
    default:
      return 'Clocked in successfully!';
  }
}
