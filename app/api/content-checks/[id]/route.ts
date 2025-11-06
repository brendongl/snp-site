import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { logger } from '@/lib/logger';

export async function GET(
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

    // Fetch the content check from PostgreSQL
    const db = DatabaseService.initialize();
    const check = await db.contentChecks.getCheckById(id);

    if (!check) {
      return NextResponse.json(
        { error: 'Content check not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      check,
    });
  } catch (error) {
    console.error('Error fetching content check:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content check' },
      { status: 500 }
    );
  }
}

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

    const db = DatabaseService.initialize();

    // Get content check details before deletion for point refund
    const checkResult = await db.pool.query(`
      SELECT
        cc.inspector_id,
        cc.game_id,
        g.name as game_name,
        g.complexity,
        sl.staff_name
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.id
      WHERE cc.id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Content check not found' },
        { status: 404 }
      );
    }

    const check = checkResult.rows[0];
    const pointsToRefund = -(1000 * (check.complexity || 1)); // Negative points for refund

    // Log deletion to changelog with negative points
    try {
      const maxIdResult = await db.pool.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM changelog');
      const changelogId = maxIdResult.rows[0].next_id;

      await db.pool.query(`
        INSERT INTO changelog (
          id,
          event_type,
          category,
          staff_id,
          entity_id,
          entity_name,
          points_awarded,
          point_category,
          description,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        changelogId,
        'deleted',
        'content_check',
        check.inspector_id,
        check.game_id,
        check.game_name,
        pointsToRefund,
        'content_check',
        `Content check deleted for ${check.game_name || 'unknown game'}`
      ]);

      // Subtract points from staff member
      await db.pool.query(`
        UPDATE staff_list
        SET points = points + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [pointsToRefund, check.inspector_id]);

      logger.info('Content Check', `Refunded ${pointsToRefund} points to ${check.staff_name}`, {
        checkId: id,
        gameName: check.game_name
      });
    } catch (refundError) {
      logger.error('Content Check', 'Failed to log deletion or refund points', refundError instanceof Error ? refundError : new Error(String(refundError)));
      // Continue with deletion even if refund fails
    }

    // Delete the content check from PostgreSQL
    await db.contentChecks.deleteCheck(id);

    return NextResponse.json({
      success: true,
      message: 'Content check deleted successfully and points refunded',
      id,
      pointsRefunded: Math.abs(pointsToRefund),
    });
  } catch (error) {
    console.error('Error deleting content check:', error);
    return NextResponse.json(
      { error: 'Failed to delete content check' },
      { status: 500 }
    );
  }
}
