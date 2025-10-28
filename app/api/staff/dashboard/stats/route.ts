import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET() {
  try {
    // Games needing check (30 day threshold)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);
    const gamesNeedingCheckResult = await pool.query(
      `
      WITH latest_checks AS (
        SELECT game_id, MAX(check_date) as last_checked
        FROM content_checks
        GROUP BY game_id
      )
      SELECT COUNT(*) as count
      FROM games g
      LEFT JOIN latest_checks lc ON g.id = lc.game_id
      WHERE lc.last_checked IS NULL OR lc.last_checked < $1
      `,
      [thresholdDate.toISOString()]
    );

    // Play logs today
    const today = new Date().toISOString().split('T')[0];
    const playLogsTodayResult = await pool.query(
      'SELECT COUNT(*) as count FROM play_logs WHERE session_date >= $1',
      [today]
    );

    // Play logs this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const playLogsWeekResult = await pool.query(
      'SELECT COUNT(*) as count FROM play_logs WHERE session_date >= $1',
      [weekAgo.toISOString().split('T')[0]]
    );

    // Knowledge gaps (games with missing knowledge)
    const knowledgeGapsResult = await pool.query(`
      SELECT COUNT(DISTINCT g.id) as count
      FROM games g
      WHERE g.id NOT IN (
        SELECT DISTINCT game_id
        FROM staff_knowledge
        WHERE can_teach = true
      )
    `);

    return NextResponse.json({
      gamesNeedingCheck: parseInt(gamesNeedingCheckResult.rows[0].count),
      playLogsToday: parseInt(playLogsTodayResult.rows[0].count),
      playLogsThisWeek: parseInt(playLogsWeekResult.rows[0].count),
      knowledgeGaps: parseInt(knowledgeGapsResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
