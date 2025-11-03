/**
 * GET /api/staff/points?staffId=uuid
 *
 * Get staff member's points and basic info
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');

    if (!staffId) {
      return NextResponse.json(
        { error: 'staffId parameter is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
        id,
        staff_name as name,
        staff_email as email,
        points,
        vikunja_user_id as "vikunjaUserId",
        vikunja_username as "vikunjaUsername"
      FROM staff_list
      WHERE id = $1`,
      [staffId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    const staff = result.rows[0];

    return NextResponse.json({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      points: staff.points || 0,
      vikunjaUserId: staff.vikunjaUserId,
      vikunjaUsername: staff.vikunjaUsername
    });

  } catch (error) {
    console.error('Error fetching staff points:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
