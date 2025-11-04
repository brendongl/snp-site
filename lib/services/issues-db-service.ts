/**
 * Issues Database Service
 * Part of v1.5.0 - Issue Reporting & Points System
 *
 * Handles CRUD operations for game_issues table
 * Separates actionable issues (Vikunja tasks) from non-actionable issues (tracking only)
 */

import { Pool } from 'pg';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export interface GameIssue {
  id: string;
  game_id: string;
  reported_by_id: string;
  issue_category: string;
  issue_type: 'actionable' | 'non_actionable';
  description: string;
  vikunja_task_id: number | null;
  resolved_at: Date | null;
  resolved_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface GameIssueWithDetails extends GameIssue {
  game_name?: string;
  reporter_name?: string;
  resolver_name?: string;
}

/**
 * Create a new issue
 */
export async function createIssue(data: {
  gameId: string;
  reportedById: string;
  issueCategory: string;
  issueType: 'actionable' | 'non_actionable';
  description: string;
  vikunjaTaskId?: number;
}): Promise<GameIssue> {
  const id = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const result = await pool.query(`
    INSERT INTO game_issues (
      id,
      game_id,
      reported_by_id,
      issue_category,
      issue_type,
      description,
      vikunja_task_id,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `, [
    id,
    data.gameId,
    data.reportedById,
    data.issueCategory,
    data.issueType,
    data.description,
    data.vikunjaTaskId || null
  ]);

  return result.rows[0];
}

/**
 * Get all unresolved issues for a specific game
 */
export async function getUnresolvedIssuesByGameId(gameId: string): Promise<GameIssueWithDetails[]> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as game_name,
      s1.staff_name as reporter_name
    FROM game_issues gi
    LEFT JOIN games g ON gi.game_id = g.id
    LEFT JOIN staff_list s1 ON gi.reported_by_id = s1.id
    WHERE gi.game_id = $1
      AND gi.resolved_at IS NULL
    ORDER BY gi.created_at DESC
  `, [gameId]);

  return result.rows;
}

/**
 * Get all issues for a specific game (including resolved)
 */
export async function getAllIssuesByGameId(gameId: string): Promise<GameIssueWithDetails[]> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as game_name,
      s1.staff_name as reporter_name,
      s2.staff_name as resolver_name
    FROM game_issues gi
    LEFT JOIN games g ON gi.game_id = g.id
    LEFT JOIN staff_list s1 ON gi.reported_by_id = s1.id
    LEFT JOIN staff_list s2 ON gi.resolved_by_id = s2.id
    WHERE gi.game_id = $1
    ORDER BY gi.created_at DESC
  `, [gameId]);

  return result.rows;
}

/**
 * Get all non-actionable issues (for overview page)
 */
export async function getAllNonActionableIssues(): Promise<GameIssueWithDetails[]> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as game_name,
      s.staff_name as reporter_name
    FROM game_issues gi
    LEFT JOIN games g ON gi.game_id = g.id
    LEFT JOIN staff_list s ON gi.reported_by_id = s.id
    WHERE gi.issue_type = 'non_actionable'
      AND gi.resolved_at IS NULL
    ORDER BY gi.created_at DESC
  `);

  return result.rows;
}

/**
 * Get all actionable issues with Vikunja task IDs
 */
export async function getAllActionableIssues(): Promise<GameIssueWithDetails[]> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as game_name,
      s.staff_name as reporter_name
    FROM game_issues gi
    LEFT JOIN games g ON gi.game_id = g.id
    LEFT JOIN staff_list s ON gi.reported_by_id = s.id
    WHERE gi.issue_type = 'actionable'
      AND gi.resolved_at IS NULL
      AND gi.vikunja_task_id IS NOT NULL
    ORDER BY gi.created_at DESC
  `);

  return result.rows;
}

/**
 * Get issue by ID
 */
export async function getIssueById(issueId: string): Promise<GameIssueWithDetails | null> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as game_name,
      g.complexity as game_complexity,
      s1.staff_name as reporter_name,
      s2.staff_name as resolver_name
    FROM game_issues gi
    LEFT JOIN games g ON gi.game_id = g.id
    LEFT JOIN staff_list s1 ON gi.reported_by_id = s1.id
    LEFT JOIN staff_list s2 ON gi.resolved_by_id = s2.id
    WHERE gi.id = $1
  `, [issueId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Get issue by Vikunja task ID
 */
export async function getIssueByVikunjaTaskId(taskId: number): Promise<GameIssueWithDetails | null> {
  const result = await pool.query(`
    SELECT
      gi.*,
      g.name as game_name,
      g.complexity as game_complexity,
      s1.staff_name as reporter_name,
      s2.staff_name as resolver_name
    FROM game_issues gi
    LEFT JOIN games g ON gi.game_id = g.id
    LEFT JOIN staff_list s1 ON gi.reported_by_id = s1.id
    LEFT JOIN staff_list s2 ON gi.resolved_by_id = s2.id
    WHERE gi.vikunja_task_id = $1
  `, [taskId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Resolve an issue
 */
export async function resolveIssue(
  issueId: string,
  resolvedById: string
): Promise<GameIssue> {
  const result = await pool.query(`
    UPDATE game_issues
    SET resolved_at = NOW(),
        resolved_by_id = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [issueId, resolvedById]);

  if (result.rows.length === 0) {
    throw new Error(`Issue not found: ${issueId}`);
  }

  return result.rows[0];
}

/**
 * Update issue description
 */
export async function updateIssueDescription(
  issueId: string,
  description: string
): Promise<GameIssue> {
  const result = await pool.query(`
    UPDATE game_issues
    SET description = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [issueId, description]);

  if (result.rows.length === 0) {
    throw new Error(`Issue not found: ${issueId}`);
  }

  return result.rows[0];
}

/**
 * Delete an issue (admin only)
 */
export async function deleteIssue(issueId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM game_issues WHERE id = $1',
    [issueId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Get issue statistics
 */
export async function getIssueStatistics(): Promise<{
  total: number;
  actionable: number;
  nonActionable: number;
  resolved: number;
  byCategory: Record<string, number>;
}> {
  // Get total counts
  const totalResult = await pool.query('SELECT COUNT(*) as count FROM game_issues');
  const total = parseInt(totalResult.rows[0].count);

  const actionableResult = await pool.query(`
    SELECT COUNT(*) as count FROM game_issues
    WHERE issue_type = 'actionable' AND resolved_at IS NULL
  `);
  const actionable = parseInt(actionableResult.rows[0].count);

  const nonActionableResult = await pool.query(`
    SELECT COUNT(*) as count FROM game_issues
    WHERE issue_type = 'non_actionable' AND resolved_at IS NULL
  `);
  const nonActionable = parseInt(nonActionableResult.rows[0].count);

  const resolvedResult = await pool.query(`
    SELECT COUNT(*) as count FROM game_issues WHERE resolved_at IS NOT NULL
  `);
  const resolved = parseInt(resolvedResult.rows[0].count);

  // Get by category
  const categoryResult = await pool.query(`
    SELECT issue_category, COUNT(*) as count
    FROM game_issues
    WHERE resolved_at IS NULL
    GROUP BY issue_category
  `);

  const byCategory: Record<string, number> = {};
  categoryResult.rows.forEach(row => {
    byCategory[row.issue_category] = parseInt(row.count);
  });

  return {
    total,
    actionable,
    nonActionable,
    resolved,
    byCategory
  };
}

export default {
  createIssue,
  getUnresolvedIssuesByGameId,
  getAllIssuesByGameId,
  getAllNonActionableIssues,
  getAllActionableIssues,
  getIssueById,
  getIssueByVikunjaTaskId,
  resolveIssue,
  updateIssueDescription,
  deleteIssue,
  getIssueStatistics
};
