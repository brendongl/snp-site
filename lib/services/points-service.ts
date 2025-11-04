/**
 * Points Service - Centralized point calculation and award system
 * Part of v1.5.0 - Issue Reporting & Points System
 *
 * Handles all point awards across 7 activity types:
 * 1. Play logs - 100 points
 * 2. Content checks - 1000 × complexity
 * 3. Knowledge adds - level × complexity (100-500)
 * 4. Knowledge upgrades - 100 × complexity
 * 5. Teaching - 1000 × complexity × students
 * 6. Photo uploads - 1000 points
 * 7. Issue reports - 100 points (reporter bonus)
 * 8. Issue resolutions - 500-1000 (×2 if complexity ≥ 3)
 */

import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export interface PointAwardParams {
  staffId: string;
  actionType: 'play_log' | 'content_check' | 'knowledge_add' |
               'knowledge_upgrade' | 'teaching' | 'photo_upload' |
               'issue_report' | 'issue_resolution';
  metadata: {
    gameId?: string;
    gameComplexity?: number;
    knowledgeLevel?: number;
    studentCount?: number;
    issueCategory?: string;
  };
  context?: string;
}

export interface PointAwardResult {
  success: boolean;
  pointsAwarded: number;
  newTotalPoints: number;
  changelogId?: string;
  error?: string;
}

/**
 * Knowledge level multipliers for point calculation
 */
const KNOWLEDGE_LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 100,  // Beginner
  2: 200,  // Intermediate
  3: 300,  // Expert
  4: 500   // Instructor
};

/**
 * Issue resolution base points by category
 */
const ISSUE_RESOLUTION_POINTS: Record<string, number> = {
  'broken_sleeves': 500,
  'needs_sorting': 500,
  'needs_cleaning': 500,
  'box_rewrap': 1000,
  'customer_reported': 0, // Just triggers content check
  'other_actionable': 500
};

/**
 * Calculate points based on action type and metadata
 */
export function calculatePoints(params: PointAwardParams): number {
  const { actionType, metadata } = params;
  const complexity = metadata.gameComplexity || 1;

  switch (actionType) {
    case 'play_log':
      return 100;

    case 'content_check':
      return 1000 * complexity;

    case 'knowledge_add': {
      const level = metadata.knowledgeLevel || 1;
      const multiplier = KNOWLEDGE_LEVEL_MULTIPLIERS[level] || 100;
      return multiplier * complexity;
    }

    case 'knowledge_upgrade':
      return 100 * complexity;

    case 'teaching': {
      const students = metadata.studentCount || 1;
      return 1000 * complexity * students;
    }

    case 'photo_upload':
      return 1000;

    case 'issue_report':
      return 100; // Reporter bonus (all issues)

    case 'issue_resolution': {
      const category = metadata.issueCategory || '';
      const basePoints = ISSUE_RESOLUTION_POINTS[category] || 0;
      // Multiply by 2 if game complexity >= 3
      return complexity >= 3 ? basePoints * 2 : basePoints;
    }

    default:
      console.warn(`Unknown action type: ${actionType}`);
      return 0;
  }
}

/**
 * Award points to a staff member (async, non-blocking)
 *
 * This function is designed to be fire-and-forget - it should not block
 * the main operation. If it fails, the failure is logged but does not throw.
 */
export async function awardPoints(params: PointAwardParams): Promise<PointAwardResult> {
  try {
    const points = calculatePoints(params);

    if (points === 0) {
      return {
        success: true,
        pointsAwarded: 0,
        newTotalPoints: 0
      };
    }

    // Atomic update to staff_list.points
    const result = await pool.query(`
      UPDATE staff_list
      SET points = points + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING points
    `, [points, params.staffId]);

    if (result.rows.length === 0) {
      throw new Error(`Staff member not found: ${params.staffId}`);
    }

    const newTotal = result.rows[0].points;

    // Log to changelog (audit trail)
    const changelogId = await logPointAward(params, points);

    console.log(`✅ Points awarded: ${points} to staff ${params.staffId} (new total: ${newTotal})`);

    return {
      success: true,
      pointsAwarded: points,
      newTotalPoints: newTotal,
      changelogId
    };

  } catch (error) {
    console.error('❌ Point award failed:', error);
    return {
      success: false,
      pointsAwarded: 0,
      newTotalPoints: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Log point award to changelog for audit trail
 */
async function logPointAward(
  params: PointAwardParams,
  points: number
): Promise<string> {
  const changelogId = `changelog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const description = params.context || `Points awarded for ${params.actionType.replace(/_/g, ' ')}`;

  await pool.query(`
    INSERT INTO changelog (
      id,
      event_type,
      staff_id,
      game_id,
      points_awarded,
      point_category,
      description,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `, [
    changelogId,
    'points_awarded',
    params.staffId,
    params.metadata.gameId || null,
    points,
    params.actionType,
    description
  ]);

  return changelogId;
}

/**
 * Get points breakdown for a staff member
 */
export async function getPointsBreakdown(staffId: string): Promise<{
  totalPoints: number;
  breakdown: Record<string, { count: number; points: number }>;
  recentAwards: Array<{
    id: string;
    points_awarded: number;
    point_category: string;
    description: string;
    created_at: Date;
  }>;
}> {
  // Get total points
  const staffResult = await pool.query(
    'SELECT points FROM staff_list WHERE id = $1',
    [staffId]
  );
  const totalPoints = staffResult.rows[0]?.points || 0;

  // Get breakdown by category
  const breakdownResult = await pool.query(`
    SELECT
      point_category,
      COUNT(*) as count,
      SUM(points_awarded) as points
    FROM changelog
    WHERE staff_id = $1 AND point_category IS NOT NULL
    GROUP BY point_category
  `, [staffId]);

  const breakdown: Record<string, { count: number; points: number }> = {};
  breakdownResult.rows.forEach(row => {
    breakdown[row.point_category] = {
      count: parseInt(row.count),
      points: parseInt(row.points)
    };
  });

  // Get recent awards
  const recentResult = await pool.query(`
    SELECT id, points_awarded, point_category, description, created_at
    FROM changelog
    WHERE staff_id = $1 AND point_category IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 10
  `, [staffId]);

  return {
    totalPoints,
    breakdown,
    recentAwards: recentResult.rows
  };
}

/**
 * Recalculate all points for a staff member (admin tool)
 * WARNING: This is for emergency use only. Normal point awards should go through awardPoints()
 */
export async function recalculateStaffPoints(staffId: string): Promise<number> {
  // Sum all points from changelog
  const result = await pool.query(`
    SELECT COALESCE(SUM(points_awarded), 0) as total
    FROM changelog
    WHERE staff_id = $1 AND point_category IS NOT NULL
  `, [staffId]);

  const calculatedTotal = parseInt(result.rows[0].total);

  // Update staff_list
  await pool.query(`
    UPDATE staff_list
    SET points = $1, updated_at = NOW()
    WHERE id = $2
  `, [calculatedTotal, staffId]);

  console.log(`✅ Recalculated points for staff ${staffId}: ${calculatedTotal}`);

  return calculatedTotal;
}

export default {
  calculatePoints,
  awardPoints,
  getPointsBreakdown,
  recalculateStaffPoints
};
