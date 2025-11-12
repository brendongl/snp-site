/**
 * API Route: /api/roster/[week]
 * Version: 2.0.0
 * Phase 1: Core API
 *
 * GET: Fetch roster for a specific week
 * PUT: Update/create shifts for a specific week
 * DELETE: Delete entire roster for a week
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterDbService from '@/lib/services/roster-db-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ week: string }> }
) {
  try {
    const { week: weekStart } = await params;

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(weekStart)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validate it's a Monday
    const date = new Date(weekStart);
    if (date.getDay() !== 1) {
      return NextResponse.json(
        { error: 'Week start must be a Monday' },
        { status: 400 }
      );
    }

    const shifts = await RosterDbService.getShiftsByWeek(weekStart);

    return NextResponse.json({
      weekStart,
      shifts,
      totalShifts: shifts.length
    });
  } catch (error: any) {
    console.error('Error fetching roster:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roster', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ week: string }> }
) {
  try {
    // TODO: Phase 3 - Add admin authentication check
    const { week: weekStart } = await params;
    const body = await request.json();
    const { shifts, replaceAll } = body;

    if (!Array.isArray(shifts)) {
      return NextResponse.json(
        { error: 'Shifts must be an array' },
        { status: 400 }
      );
    }

    // If replaceAll is true, delete existing shifts first
    if (replaceAll) {
      await RosterDbService.deleteShiftsByWeek(weekStart);
    }

    // Create all shifts
    const createdShifts = [];
    for (const shift of shifts) {
      const created = await RosterDbService.createShift({
        roster_week_start: weekStart,
        day_of_week: shift.day_of_week,
        shift_type: shift.shift_type,
        staff_id: shift.staff_id,
        scheduled_start: shift.scheduled_start,
        scheduled_end: shift.scheduled_end,
        role_required: shift.role_required,
        shift_notes: shift.shift_notes,
        clock_in_reminder: shift.clock_in_reminder
      });
      createdShifts.push(created);
    }

    return NextResponse.json({
      success: true,
      weekStart,
      shifts: createdShifts,
      totalShifts: createdShifts.length
    });
  } catch (error: any) {
    console.error('Error updating roster:', error);
    return NextResponse.json(
      { error: 'Failed to update roster', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ week: string }> }
) {
  try {
    // TODO: Phase 3 - Add admin authentication check
    const { week: weekStart } = await params;
    await RosterDbService.deleteShiftsByWeek(weekStart);

    return NextResponse.json({
      success: true,
      message: `Deleted all shifts for week starting ${weekStart}`
    });
  } catch (error: any) {
    console.error('Error deleting roster:', error);
    return NextResponse.json(
      { error: 'Failed to delete roster', details: error.message },
      { status: 500 }
    );
  }
}
