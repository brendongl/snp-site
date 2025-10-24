import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Content check ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      status,
      boxCondition,
      cardCondition,
      missingPieces,
      notes,
      sleevedAtCheck,
      boxWrappedAtCheck,
    } = body;

    // Update the content check in PostgreSQL
    const db = DatabaseService.initialize();

    // Build updates object with only provided fields
    const updates: any = {};
    if (status !== undefined) updates.status = [status]; // Convert to array for service
    if (boxCondition !== undefined) updates.boxCondition = boxCondition;
    if (cardCondition !== undefined) updates.cardCondition = cardCondition;
    if (missingPieces !== undefined) updates.missingPieces = missingPieces;
    if (notes !== undefined) updates.notes = notes;
    if (sleevedAtCheck !== undefined) updates.sleeved = sleevedAtCheck;
    if (boxWrappedAtCheck !== undefined) updates.boxWrapped = boxWrappedAtCheck;

    const updatedCheck = await db.contentChecks.updateCheck(id, updates);

    return NextResponse.json({
      success: true,
      message: 'Content check updated successfully',
      check: updatedCheck,
    });
  } catch (error) {
    console.error('Error updating content check:', error);
    return NextResponse.json(
      { error: 'Failed to update content check' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Content check ID is required' },
        { status: 400 }
      );
    }

    // Delete the content check from PostgreSQL
    const db = DatabaseService.initialize();
    await db.contentChecks.deleteCheck(id);

    return NextResponse.json({
      success: true,
      message: 'Content check deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Error deleting content check:', error);
    return NextResponse.json(
      { error: 'Failed to delete content check' },
      { status: 500 }
    );
  }
}
