import { NextRequest, NextResponse } from 'next/server';
import { RosterDbService } from '@/lib/services/roster-db-service';

/**
 * GET /api/roster/shift-swap
 * Get shift swap requests for a staff member
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staff_id');

    if (!staffId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: staff_id',
        },
        { status: 400 }
      );
    }

    const swaps = await RosterDbService.getShiftSwapsByStaffId(staffId);

    return NextResponse.json({
      success: true,
      swaps,
    });
  } catch (error) {
    console.error('Error fetching shift swaps:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch shift swaps',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/shift-swap
 * Create a new shift swap request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shift_id, requesting_staff_id, target_staff_id, reason } = body;

    // Validate required fields
    if (!shift_id || !requesting_staff_id || !target_staff_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: shift_id, requesting_staff_id, target_staff_id',
        },
        { status: 400 }
      );
    }

    // Prevent self-swap
    if (requesting_staff_id === target_staff_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot request to swap shift with yourself',
        },
        { status: 400 }
      );
    }

    const swap = await RosterDbService.createShiftSwap({
      shift_id,
      requesting_staff_id,
      target_staff_id,
      reason,
    });

    return NextResponse.json({
      success: true,
      swap,
      message: 'Shift swap request created successfully',
    });
  } catch (error) {
    console.error('Error creating shift swap:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create shift swap',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roster/shift-swap
 * Approve or veto a shift swap request
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { swap_id, action, resolved_by, notes } = body;

    if (!swap_id || !action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: swap_id, action',
        },
        { status: 400 }
      );
    }

    let swap;

    if (action === 'approve') {
      swap = await RosterDbService.approveShiftSwap(
        swap_id,
        resolved_by || null,
        false, // Not auto-approved
        notes
      );
    } else if (action === 'veto') {
      if (!resolved_by) {
        return NextResponse.json(
          {
            success: false,
            error: 'resolved_by is required for veto action',
          },
          { status: 400 }
        );
      }

      swap = await RosterDbService.vetoShiftSwap(swap_id, resolved_by, notes);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "approve" or "veto"',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      swap,
      message: `Shift swap ${action}d successfully`,
    });
  } catch (error) {
    console.error('Error updating shift swap:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update shift swap',
      },
      { status: 500 }
    );
  }
}
