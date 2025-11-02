import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import GamesDbService from '@/lib/services/games-db-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET() {
  try {
    // v1.3.0: Calculate games needing check using intelligent criteria
    // Fetch all games with their latest check data
    const gamesResult = await pool.query(`
      SELECT
        id,
        name,
        date_of_acquisition,
        latest_check_date
      FROM games
    `);

    // Fetch all play logs grouped by game
    const playLogsResult = await pool.query(`
      SELECT
        game_id,
        session_date,
        created_at
      FROM play_logs
      ORDER BY game_id, session_date DESC
    `);

    // Group play logs by game_id
    const playLogsByGame = playLogsResult.rows.reduce((acc, log) => {
      if (!acc[log.game_id]) {
        acc[log.game_id] = [];
      }
      acc[log.game_id].push(log);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculate needs checking for each game
    let gamesNeedingCheckCount = 0;
    for (const game of gamesResult.rows) {
      const gameData = {
        fields: {
          'Date of Aquisition': game.date_of_acquisition,
          'Latest Check Date': game.latest_check_date,
        },
      };

      const playLogs = playLogsByGame[game.id] || [];
      const needsCheckingInfo = GamesDbService.calculateNeedsChecking(gameData, playLogs);

      if (needsCheckingInfo.needsChecking) {
        gamesNeedingCheckCount++;
      }
    }

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
      gamesNeedingCheck: gamesNeedingCheckCount, // v1.3.0: Now uses intelligent criteria
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
