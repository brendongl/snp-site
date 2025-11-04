/**
 * GET /api/staff/[id]/points
 *
 * Fetch staff member's points summary and breakdown
 * - Total points
 * - Breakdown by category (play logs, content checks, knowledge, etc.)
 * - Recent point awards (last 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPointsBreakdown } from '@/lib/services/points-service';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: staffId } = await params;

    // Verify staff member exists
    const staffResult = await pool.query(
      'SELECT id, staff_name, points FROM staff_list WHERE id = $1',
      [staffId]
    );

    if (staffResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    const staff = staffResult.rows[0];

    // Get points breakdown from points service
    const pointsData = await getPointsBreakdown(staffId);

    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.staff_name,
        totalPoints: pointsData.totalPoints
      },
      breakdown: pointsData.breakdown,
      recentAwards: pointsData.recentAwards.map(award => ({
        id: award.id,
        points: award.points_awarded,
        category: award.point_category,
        description: award.description,
        earnedAt: award.created_at
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching staff points:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch staff points',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
