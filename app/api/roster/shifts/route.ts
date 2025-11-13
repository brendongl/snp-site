/**
 * Roster Shifts API
 * GET /api/roster/shifts - Fetch saved shifts for a specific week
 *
 * For Phase 3.1, this endpoint returns generated roster data.
 * In future phases, this will fetch from a dedicated `roster_shifts` table.
 */

import { NextRequest, NextResponse } from 'next/server';

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

    // Validate it's a Monday
    const date = new Date(weekStart + 'T00:00:00');
    if (date.getDay() !== 1) {
      return NextResponse.json(
        { error: 'week_start must be a Monday' },
        { status: 400 }
      );
    }

    // For Phase 3.1: Generate roster on-the-fly
    // TODO: In Phase 3.2, this will fetch saved shifts from roster_shifts table
    const generateResponse = await fetch(
      `${request.nextUrl.origin}/api/roster/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          week_start: weekStart,
          use_default_requirements: true,
        }),
      }
    );

    if (!generateResponse.ok) {
      throw new Error('Failed to generate roster');
    }

    const rosterData = await generateResponse.json();

    // Extract shifts from generated roster and add temporary IDs
    const shifts = (rosterData.solution?.assignments || []).map((shift: any) => ({
      ...shift,
      // Generate temporary ID from shift attributes for edit dialog detection
      id: `temp_${shift.staff_id}_${shift.day_of_week}_${shift.scheduled_start}`.replace(/[:\s]/g, '_'),
    }));

    return NextResponse.json({
      success: true,
      week_start: weekStart,
      shifts,
      metadata: {
        total_shifts: shifts.length,
        staff_count: new Set(shifts.map((s: any) => s.staff_id)).size,
        generated_at: new Date().toISOString(),
        source: 'generated', // Will be 'saved' when we implement persistence
      },
    });

  } catch (error) {
    console.error('Error fetching roster shifts:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch roster shifts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
