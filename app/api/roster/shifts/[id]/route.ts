/**
 * Roster Shift Edit API
 * PUT /api/roster/shifts/[id] - Update an existing shift
 * DELETE /api/roster/shifts/[id] - Delete a shift
 *
 * Phase 3.2: Draft/Publish workflow
 * - Marks shift as edited_after_publish if editing a published shift
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { scheduled_start, scheduled_end, role_required, shift_type, staff_id } = body;

    await client.query('BEGIN');

    // Get current shift info
    const currentShift = await client.query(
      'SELECT is_published, roster_week_start FROM roster_shifts WHERE id = $1',
      [id]
    );

    if (currentShift.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    const isPublished = currentShift.rows[0].is_published;
    const weekStart = currentShift.rows[0].roster_week_start;

    // Update the shift
    const updateResult = await client.query(
      `UPDATE roster_shifts
       SET scheduled_start = COALESCE($1, scheduled_start),
           scheduled_end = COALESCE($2, scheduled_end),
           role_required = COALESCE($3, role_required),
           shift_type = COALESCE($4, shift_type),
           staff_id = COALESCE($5, staff_id),
           edited_after_publish = CASE
             WHEN $6 THEN true
             ELSE edited_after_publish
           END,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        scheduled_start,
        scheduled_end,
        role_required,
        shift_type,
        staff_id,
        isPublished, // If the shift is published, mark as edited_after_publish
        id,
      ]
    );

    await client.query('COMMIT');

    const updatedShift = updateResult.rows[0];

    console.log(`[Roster Shifts] Updated shift ${id}${isPublished ? ' (marked as edited_after_publish)' : ''}`);

    return NextResponse.json({
      success: true,
      shift: updatedShift,
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating roster shift:', error);

    return NextResponse.json(
      {
        error: 'Failed to update roster shift',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Delete the shift
    const result = await pool.query(
      'DELETE FROM roster_shifts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    console.log(`[Roster Shifts] Deleted shift ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Shift deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting roster shift:', error);

    return NextResponse.json(
      {
        error: 'Failed to delete roster shift',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
