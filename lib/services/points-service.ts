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
               'issue_report' | 'issue_resolution' | 'task_complete';
  points?: number; // Optional explicit points (for task_complete)
  metadata?: {
    gameId?: string;
    gameName?: string;  // v1.5.20: Add game name for changelog entity_name
    gameComplexity?: number;
    knowledgeLevel?: number;
    studentCount?: number;
    issueCategory?: string;
    taskId?: number;
    taskTitle?: string;
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
 * Points configuration cache (refreshed from database)
 */
interface PointConfig {
  action_type: string;
  base_points: number;
  uses_complexity: boolean;
  uses_level_multiplier: boolean;
  uses_student_count: boolean;
  description: string;
}

let pointsConfigCache: Record<string, PointConfig> = {};
let lastConfigLoad = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load points configuration from database
 */
async function loadPointsConfig(): Promise<Record<string, PointConfig>> {
  // Return cached config if still valid
  if (Date.now() - lastConfigLoad < CONFIG_CACHE_TTL && Object.keys(pointsConfigCache).length > 0) {
    return pointsConfigCache;
  }

  try {
    const result = await pool.query('SELECT * FROM points_config');

    pointsConfigCache = result.rows.reduce((acc: Record<string, PointConfig>, row: any) => {
      acc[row.action_type] = row;
      return acc;
    }, {});

    lastConfigLoad = Date.now();
    console.log(`✅ Loaded ${result.rows.length} point configurations from database`);

    return pointsConfigCache;
  } catch (error) {
    console.error('❌ Failed to load points config from database:', error);

    // Return cached config if database fails
    if (Object.keys(pointsConfigCache).length > 0) {
      console.warn('⚠️ Using stale cached config due to database error');
      return pointsConfigCache;
    }

    // Fallback to hardcoded defaults
    console.warn('⚠️ Using hardcoded fallback config');
    return {
      'play_log': { action_type: 'play_log', base_points: 100, uses_complexity: false, uses_level_multiplier: false, uses_student_count: false, description: 'Play log' },
      'content_check': { action_type: 'content_check', base_points: 1000, uses_complexity: true, uses_level_multiplier: false, uses_student_count: false, description: 'Content check' },
      'knowledge_add_level_1': { action_type: 'knowledge_add_level_1', base_points: 100, uses_complexity: true, uses_level_multiplier: false, uses_student_count: false, description: 'Knowledge level 1' },
      'knowledge_add_level_2': { action_type: 'knowledge_add_level_2', base_points: 200, uses_complexity: true, uses_level_multiplier: false, uses_student_count: false, description: 'Knowledge level 2' },
      'knowledge_add_level_3': { action_type: 'knowledge_add_level_3', base_points: 300, uses_complexity: true, uses_level_multiplier: false, uses_student_count: false, description: 'Knowledge level 3' },
      'knowledge_add_level_4': { action_type: 'knowledge_add_level_4', base_points: 500, uses_complexity: true, uses_level_multiplier: false, uses_student_count: false, description: 'Knowledge level 4' },
      'knowledge_upgrade': { action_type: 'knowledge_upgrade', base_points: 100, uses_complexity: true, uses_level_multiplier: false, uses_student_count: false, description: 'Knowledge upgrade' },
      'teaching': { action_type: 'teaching', base_points: 1000, uses_complexity: true, uses_level_multiplier: false, uses_student_count: true, description: 'Teaching' },
      'photo_upload': { action_type: 'photo_upload', base_points: 1000, uses_complexity: false, uses_level_multiplier: false, uses_student_count: false, description: 'Photo upload' },
      'issue_report': { action_type: 'issue_report', base_points: 100, uses_complexity: false, uses_level_multiplier: false, uses_student_count: false, description: 'Issue report' },
      'issue_resolution_basic': { action_type: 'issue_resolution_basic', base_points: 500, uses_complexity: false, uses_level_multiplier: false, uses_student_count: false, description: 'Issue resolution basic' },
      'issue_resolution_complex': { action_type: 'issue_resolution_complex', base_points: 1000, uses_complexity: false, uses_level_multiplier: false, uses_student_count: false, description: 'Issue resolution complex' },
    };
  }
}

/**
 * Calculate points based on action type and metadata (async to load config)
 */
export async function calculatePoints(params: PointAwardParams): Promise<number> {
  const { actionType, metadata, points } = params;

  // For task_complete, use explicit points value
  if (actionType === 'task_complete' && points !== undefined) {
    return points;
  }

  // Load configuration from database
  const config = await loadPointsConfig();

  const complexity = metadata?.gameComplexity || 1;

  switch (actionType) {
    case 'play_log': {
      const cfg = config['play_log'];
      return cfg ? cfg.base_points : 100;
    }

    case 'content_check': {
      const cfg = config['content_check'];
      const basePoints = cfg ? cfg.base_points : 1000;
      return basePoints * complexity;
    }

    case 'knowledge_add': {
      const level = metadata?.knowledgeLevel || 1;
      const configKey = `knowledge_add_level_${level}`;
      const cfg = config[configKey];
      const basePoints = cfg ? cfg.base_points : (level * 100);
      return basePoints * complexity;
    }

    case 'knowledge_upgrade': {
      const cfg = config['knowledge_upgrade'];
      const basePoints = cfg ? cfg.base_points : 100;
      return basePoints * complexity;
    }

    case 'teaching': {
      const cfg = config['teaching'];
      const basePoints = cfg ? cfg.base_points : 1000;
      return basePoints * complexity;
    }

    case 'photo_upload': {
      const cfg = config['photo_upload'];
      return cfg ? cfg.base_points : 1000;
    }

    case 'issue_report': {
      const cfg = config['issue_report'];
      return cfg ? cfg.base_points : 100;
    }

    case 'issue_resolution': {
      const isComplex = complexity >= 3;
      const configKey = isComplex ? 'issue_resolution_complex' : 'issue_resolution_basic';
      const cfg = config[configKey];
      return cfg ? cfg.base_points : (isComplex ? 1000 : 500);
    }

    case 'task_complete':
      // Fallback if no explicit points provided
      return 0;

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
    const points = await calculatePoints(params);

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
  // Get next available ID (max + 1)
  const maxIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM changelog');
  const changelogId = maxIdResult.rows[0].next_id;

  const description = params.context || `Points awarded for ${params.actionType.replace(/_/g, ' ')}`;

  // Determine entity_id and entity_name based on action type
  let entityId = null;
  let entityName = null;

  if (params.metadata?.gameId) {
    entityId = params.metadata.gameId;
  } else if (params.metadata?.taskId) {
    entityId = params.metadata.taskId.toString();
  }

  if (params.metadata?.taskTitle) {
    entityName = params.metadata.taskTitle;
  } else if (params.metadata?.gameName) {
    entityName = params.metadata.gameName;  // v1.5.20: Add support for gameName in metadata
  }

  // Determine category and event_type based on action
  let category = 'points';
  let eventType = 'created';

  // Map action types to their proper categories
  switch (params.actionType) {
    case 'content_check':
      category = 'content_check';
      eventType = 'created';
      break;
    case 'knowledge_add':
      category = 'staff_knowledge';
      eventType = 'created';
      break;
    case 'knowledge_upgrade':
      category = 'staff_knowledge';
      eventType = 'updated';
      break;
    case 'play_log':
      category = 'play_log';
      eventType = 'created';
      break;
    case 'photo_upload':
      category = 'photo';
      eventType = 'created';
      break;
    case 'teaching':
      category = 'teaching';
      eventType = 'created';
      break;
    case 'issue_report':
      category = 'issue_report';
      eventType = 'created';
      break;
    case 'issue_resolution':
      category = 'task';
      eventType = 'updated';
      break;
    case 'task_complete':
      category = 'task';
      eventType = 'updated';
      break;
    default:
      // Fallback for unknown action types
      category = 'points';
      eventType = 'created';
  }

  await pool.query(`
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
    eventType,
    category,
    params.staffId,
    entityId,
    entityName,
    points,
    params.actionType,
    description
  ]);

  return changelogId.toString();
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
