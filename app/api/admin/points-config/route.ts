/**
 * GET /api/admin/points-config - Fetch all point configurations
 * PUT /api/admin/points-config - Update point value(s)
 *
 * Admin-only endpoints for managing point values
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch all point configurations
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        id,
        action_type,
        base_points,
        uses_complexity,
        uses_level_multiplier,
        uses_student_count,
        description,
        updated_at,
        updated_by_id
      FROM points_config
      ORDER BY action_type
    `);

    return NextResponse.json({
      success: true,
      config: result.rows
    });

  } catch (error) {
    console.error('Error fetching points config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch points configuration', success: false },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * PUT - Update point configuration(s)
 * Body: { updates: [{ action_type, base_points }], updatedById: string }
 */
export async function PUT(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { updates, updatedById } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required', success: false },
        { status: 400 }
      );
    }

    if (!updatedById) {
      return NextResponse.json(
        { error: 'updatedById is required', success: false },
        { status: 400 }
      );
    }

    // Begin transaction
    await client.query('BEGIN');

    const updatedConfigs = [];

    for (const update of updates) {
      const { action_type, base_points } = update;

      if (!action_type || base_points === undefined) {
        throw new Error(`Invalid update: ${JSON.stringify(update)}`);
      }

      const result = await client.query(`
        UPDATE points_config
        SET
          base_points = $1,
          updated_at = NOW(),
          updated_by_id = $2
        WHERE action_type = $3
        RETURNING *
      `, [base_points, updatedById, action_type]);

      if (result.rows.length > 0) {
        updatedConfigs.push(result.rows[0]);
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Updated ${updatedConfigs.length} point configurations`);

    return NextResponse.json({
      success: true,
      updated: updatedConfigs.length,
      config: updatedConfigs
    });

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('Error updating points config:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update points configuration',
        success: false
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
