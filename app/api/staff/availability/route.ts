/**
 * API Route: /api/staff/availability
 * Version: 2.0.0
 * Phase 1: Core API
 *
 * GET: Fetch availability for a specific staff member
 * PUT: Update availability (weekly pattern or one-time)
 * POST: Bulk update weekly availability pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterDbService from '@/lib/services/roster-db-service';
import type { StaffAvailability } from '@/types';

/**
 * GET /api/staff/availability?staff_id=xxx
 * Get availability for a specific staff member
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

    const availability = await RosterDbService.getAvailabilityByStaffId(staffId);

    // Group by day for easier frontend consumption
    const byDay: Record<string, StaffAvailability[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    };

    availability.forEach(slot => {
      byDay[slot.day_of_week].push(slot);
    });

    return NextResponse.json({
      staff_id: staffId,
      availability,
      by_day: byDay
    });
  } catch (error: any) {
    console.error('Error fetching availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/staff/availability
 * Update a single availability slot
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, day_of_week, hour_start, hour_end, availability_status } = body;

    // Validate required fields
    if (!staff_id || !day_of_week || hour_start === undefined || hour_end === undefined || !availability_status) {
      return NextResponse.json(
        { error: 'Missing required fields: staff_id, day_of_week, hour_start, hour_end, availability_status' },
        { status: 400 }
      );
    }

    // Validate day of week
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (!validDays.includes(day_of_week)) {
      return NextResponse.json(
        { error: 'Invalid day_of_week' },
        { status: 400 }
      );
    }

    // Validate hours (extended range: 24=12am, 25=1am, 26=2am)
    if (hour_start < 0 || hour_start > 25 || hour_end < 0 || hour_end > 26) {
      return NextResponse.json(
        { error: 'Hours must be between 0 and 26' },
        { status: 400 }
      );
    }

    // Validate availability status
    const validStatuses = ['available', 'preferred_not', 'unavailable'];
    if (!validStatuses.includes(availability_status)) {
      return NextResponse.json(
        { error: 'Invalid availability_status' },
        { status: 400 }
      );
    }

    const updated = await RosterDbService.upsertAvailability({
      staff_id,
      day_of_week,
      hour_start,
      hour_end,
      availability_status
    });

    return NextResponse.json({
      success: true,
      availability: updated
    });
  } catch (error: any) {
    console.error('Error updating availability:', error);
    return NextResponse.json(
      { error: 'Failed to update availability', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staff/availability
 * Bulk update weekly availability pattern
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, availability_slots } = body;

    if (!staff_id || !Array.isArray(availability_slots)) {
      return NextResponse.json(
        { error: 'staff_id and availability_slots (array) are required' },
        { status: 400 }
      );
    }

    // Validate each slot
    for (const slot of availability_slots) {
      if (!slot.day_of_week || slot.hour_start === undefined || slot.hour_end === undefined || !slot.availability_status) {
        return NextResponse.json(
          { error: 'Each slot must have day_of_week, hour_start, hour_end, and availability_status' },
          { status: 400 }
        );
      }
    }

    // Add staff_id to each slot
    const slotsWithStaffId = availability_slots.map(slot => ({
      ...slot,
      staff_id
    }));

    // Bulk upsert
    await RosterDbService.bulkUpsertAvailability(slotsWithStaffId);

    // Fetch updated availability
    const updated = await RosterDbService.getAvailabilityByStaffId(staff_id);

    return NextResponse.json({
      success: true,
      message: `Updated ${availability_slots.length} availability slots`,
      availability: updated
    });
  } catch (error: any) {
    console.error('Error bulk updating availability:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update availability', details: error.message },
      { status: 500 }
    );
  }
}
