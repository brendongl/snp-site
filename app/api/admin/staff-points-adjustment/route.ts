/**
 * POST /api/admin/staff-points-adjustment
 *
 * Manually adjust staff member points
 * Logs adjustment to changelog with 'Updated' event and 'Points Config' category
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const dynamic = 'force-dynamic';

interface StaffPointsAdjustment {
  staffId: string;
  newPoints: number;
  reason?: string;
}

/**
 * GET - Fetch all staff members with their current points
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id,
        staff_name,
        staff_email,
        points,
        vikunja_username,
        updated_at
      FROM staff_list
      ORDER BY staff_name
    `);

    return NextResponse.json({
      success: true,
      staff: result.rows
    });

  } catch (error) {
    console.error('Error fetching staff points:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff points', success: false },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * POST - Manually adjust staff member points
 * Body: { adjustments: [{ staffId, newPoints, reason }], adjustedById: string }
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { adjustments, adjustedById } = body;

    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json(
        { error: 'Adjustments array is required', success: false },
        { status: 400 }
      );
    }

    if (!adjustedById) {
      return NextResponse.json(
        { error: 'adjustedById is required', success: false },
        { status: 400 }
      );
    }

    // Begin transaction
    await client.query('BEGIN');

    const adjustedStaff = [];

    for (const adjustment of adjustments) {
      const { staffId, newPoints, reason } = adjustment;

      if (!staffId || newPoints === undefined) {
        throw new Error(`Invalid adjustment: ${JSON.stringify(adjustment)}`);
      }

      // Get current points
      const currentResult = await client.query(
        'SELECT staff_name, points FROM staff_list WHERE id = $1',
        [staffId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error(`Staff member not found: ${staffId}`);
      }

      const currentStaff = currentResult.rows[0];
      const oldPoints = currentStaff.points || 0;

      // Only proceed if points are actually changing
      if (oldPoints === newPoints) {
        continue;
      }

      // Update staff points
      const updateResult = await client.query(`
        UPDATE staff_list
        SET
          points = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [newPoints, staffId]);

      if (updateResult.rows.length > 0) {
        adjustedStaff.push(updateResult.rows[0]);

        // Get next changelog ID
        const seqResult = await client.query("SELECT nextval('changelog_id_seq') as next_id");
        const changelogId = seqResult.rows[0].next_id;

        // Calculate point change
        const pointChange = newPoints - oldPoints;
        const changeSign = pointChange > 0 ? '+' : '';

        // Log to changelog with 'Updated' event and 'Points Config' category
        const description = reason
          ? `Manual adjustment: ${changeSign}${pointChange} points (${reason})`
          : `Manual adjustment: ${changeSign}${pointChange} points`;

        await client.query(`
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
          'updated',
          'points_config',
          adjustedById,
          staffId,
          currentStaff.staff_name,
          pointChange,
          'manual_adjustment',
          description
        ]);

        console.log(`✅ Adjusted points for ${currentStaff.staff_name}: ${oldPoints} → ${newPoints}`);
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      adjusted: adjustedStaff.length,
      staff: adjustedStaff
    });

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error adjusting staff points:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to adjust staff points',
        success: false
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
