import { NextRequest, NextResponse } from 'next/server';
import { RosterDbService } from '@/lib/services/roster-db-service';

/**
 * GET /api/roster/holidays
 * Fetch all holidays
 */
export async function GET() {
  try {
    const holidays = await RosterDbService.getAllHolidays();

    return NextResponse.json({
      success: true,
      holidays,
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch holidays',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/holidays
 * Create a new holiday
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { holiday_name, start_date, end_date, pay_multiplier, is_recurring } = body;

    // Validate required fields
    if (!holiday_name || !start_date || !end_date || pay_multiplier === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: holiday_name, start_date, end_date, pay_multiplier',
        },
        { status: 400 }
      );
    }

    // Validate pay multiplier
    if (typeof pay_multiplier !== 'number' || pay_multiplier < 1.0) {
      return NextResponse.json(
        {
          success: false,
          error: 'pay_multiplier must be a number >= 1.0',
        },
        { status: 400 }
      );
    }

    const holiday = await RosterDbService.createHoliday({
      holiday_name,
      start_date,
      end_date,
      pay_multiplier,
      is_recurring: is_recurring || false,
    });

    return NextResponse.json({
      success: true,
      holiday,
    });
  } catch (error) {
    console.error('Error creating holiday:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create holiday',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roster/holidays
 * Update an existing holiday
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: id',
        },
        { status: 400 }
      );
    }

    // Validate pay multiplier if provided
    if (updates.pay_multiplier !== undefined) {
      if (typeof updates.pay_multiplier !== 'number' || updates.pay_multiplier < 1.0) {
        return NextResponse.json(
          {
            success: false,
            error: 'pay_multiplier must be a number >= 1.0',
          },
          { status: 400 }
        );
      }
    }

    const holiday = await RosterDbService.updateHoliday(id, updates);

    return NextResponse.json({
      success: true,
      holiday,
    });
  } catch (error) {
    console.error('Error updating holiday:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update holiday',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roster/holidays
 * Delete a holiday
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: id',
        },
        { status: 400 }
      );
    }

    await RosterDbService.deleteHoliday(id);

    return NextResponse.json({
      success: true,
      message: 'Holiday deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete holiday',
      },
      { status: 500 }
    );
  }
}
