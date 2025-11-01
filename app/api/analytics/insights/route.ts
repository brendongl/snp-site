import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/insights
 *
 * Get comprehensive analytics insights across the system
 */
export async function GET(request: NextRequest) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database configuration missing' },
      { status: 500 }
    );
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId'); // Optional staff filter
    // 1. Games Needing Attention (no checks or last check > 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const gamesNeedingAttentionQuery = `
      SELECT
        g.id,
        g.name,
        g.latest_check_date,
        CASE
          WHEN g.latest_check_date IS NULL THEN -1
          ELSE EXTRACT(DAY FROM NOW() - g.latest_check_date)::int
        END as days_since_check
      FROM games g
      WHERE g.base_game_id IS NULL
        AND (g.latest_check_date IS NULL OR g.latest_check_date < $1)
      ORDER BY days_since_check DESC
      LIMIT 20
    `;

    const gamesNeedingAttentionResult = await pool.query(gamesNeedingAttentionQuery, [
      sixMonthsAgo.toISOString()
    ]);

    // Get total games count
    const totalGamesResult = await pool.query(
      'SELECT COUNT(*) as count FROM games WHERE base_game_id IS NULL'
    );
    const totalGames = parseInt(totalGamesResult.rows[0].count);

    const gamesNeedingAttention = {
      count: gamesNeedingAttentionResult.rows.length,
      percentage: ((gamesNeedingAttentionResult.rows.length / totalGames) * 100).toFixed(1),
      games: gamesNeedingAttentionResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        lastCheckDate: row.latest_check_date,
        daysSinceCheck: row.days_since_check
      }))
    };

    // 2. Underutilized Games (never played)
    // First get the actual count
    const underutilizedCountQuery = `
      SELECT COUNT(*) as total
      FROM games g
      LEFT JOIN play_logs pl ON g.id = pl.game_id
      WHERE g.base_game_id IS NULL
        AND pl.id IS NULL
    `;

    const underutilizedCountResult = await pool.query(underutilizedCountQuery);
    const underutilizedCount = parseInt(underutilizedCountResult.rows[0].total);

    // Then get the top 20 for display
    const underutilizedGamesQuery = `
      SELECT
        g.id,
        g.name,
        g.date_of_acquisition as date_acquired
      FROM games g
      LEFT JOIN play_logs pl ON g.id = pl.game_id
      WHERE g.base_game_id IS NULL
        AND pl.id IS NULL
      ORDER BY g.date_of_acquisition DESC NULLS LAST
      LIMIT 20
    `;

    const underutilizedGamesResult = await pool.query(underutilizedGamesQuery);

    const underutilizedGames = {
      count: underutilizedCount,
      percentage: ((underutilizedCount / totalGames) * 100).toFixed(1),
      games: underutilizedGamesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        dateAcquired: row.date_acquired
      }))
    };

    // 3. Knowledge Coverage (% of games with at least one staff knowledge entry)
    // If staffId provided, show coverage for that specific staff member
    let knowledgeCoverageQuery;
    let knowledgeCoverageParams: any[] = [];

    if (staffId) {
      knowledgeCoverageQuery = `
        SELECT
          COUNT(DISTINCT g.id) as games_with_knowledge,
          (SELECT COUNT(*) FROM games WHERE base_game_id IS NULL) as total_games
        FROM games g
        INNER JOIN staff_knowledge sk ON g.id = sk.game_id
        WHERE g.base_game_id IS NULL
          AND sk.staff_member_id = $1
      `;
      knowledgeCoverageParams = [staffId];
    } else {
      knowledgeCoverageQuery = `
        SELECT
          COUNT(DISTINCT g.id) as games_with_knowledge,
          (SELECT COUNT(*) FROM games WHERE base_game_id IS NULL) as total_games
        FROM games g
        INNER JOIN staff_knowledge sk ON g.id = sk.game_id
        WHERE g.base_game_id IS NULL
      `;
    }

    const knowledgeCoverageResult = await pool.query(knowledgeCoverageQuery, knowledgeCoverageParams);
    const gamesWithKnowledge = parseInt(knowledgeCoverageResult.rows[0].games_with_knowledge || '0');

    const knowledgeCoverage = {
      gamesWithKnowledge,
      totalGames,
      percentage: ((gamesWithKnowledge / totalGames) * 100).toFixed(1),
      staffFiltered: !!staffId // Indicate if this is filtered by staff
    };

    // 4. Teaching Capacity (staff with most "can teach" games)
    const teachingCapacityQuery = `
      SELECT
        sl.staff_name as staff_name,
        COUNT(*) as can_teach_count
      FROM staff_knowledge sk
      INNER JOIN games g ON sk.game_id = g.id
      INNER JOIN staff_list sl ON sk.staff_member_id = sl.id
      WHERE sk.can_teach = true AND g.base_game_id IS NULL
      GROUP BY sl.staff_name
      ORDER BY can_teach_count DESC
      LIMIT 10
    `;

    const teachingCapacityResult = await pool.query(teachingCapacityQuery);
    const teachingCapacity = teachingCapacityResult.rows.map((row, index) => ({
      staffName: row.staff_name,
      canTeachCount: parseInt(row.can_teach_count),
      ranking: index + 1
    }));

    // 5. Staff Specialization (top categories per staff member)
    const staffSpecializationQuery = `
      WITH staff_categories AS (
        SELECT
          sl.staff_name,
          UNNEST(g.categories) as category,
          COUNT(*) as category_count
        FROM staff_knowledge sk
        INNER JOIN games g ON sk.game_id = g.id
        INNER JOIN staff_list sl ON sk.staff_member_id = sl.id
        WHERE g.categories IS NOT NULL AND array_length(g.categories, 1) > 0
        GROUP BY sl.staff_name, UNNEST(g.categories)
      ),
      ranked_categories AS (
        SELECT
          staff_name,
          category,
          category_count,
          ROW_NUMBER() OVER (PARTITION BY staff_name ORDER BY category_count DESC) as rank
        FROM staff_categories
      )
      SELECT
        staff_name,
        json_agg(
          json_build_object('category', category, 'count', category_count)
          ORDER BY category_count DESC
        ) FILTER (WHERE rank <= 3) as top_categories
      FROM ranked_categories
      WHERE rank <= 3
      GROUP BY staff_name
      ORDER BY staff_name
    `;

    const staffSpecializationResult = await pool.query(staffSpecializationQuery);
    const staffSpecialization = staffSpecializationResult.rows.map(row => ({
      staffName: row.staff_name,
      topCategories: row.top_categories || []
    }));

    // 6. Acquisition Trends (last 12 months, monthly)
    const acquisitionTrendsQuery = `
      SELECT
        TO_CHAR(date_of_acquisition, 'YYYY-MM') as period,
        COUNT(*) as count
      FROM games
      WHERE date_of_acquisition IS NOT NULL
        AND date_of_acquisition >= NOW() - INTERVAL '12 months'
        AND base_game_id IS NULL
      GROUP BY TO_CHAR(date_of_acquisition, 'YYYY-MM')
      ORDER BY period ASC
    `;

    const acquisitionTrendsResult = await pool.query(acquisitionTrendsQuery);
    const acquisitionTrends = acquisitionTrendsResult.rows.map(row => ({
      period: row.period,
      count: parseInt(row.count)
    }));

    await pool.end();

    return NextResponse.json({
      success: true,
      gamesNeedingAttention,
      underutilizedGames,
      knowledgeCoverage,
      teachingCapacity,
      staffSpecialization,
      acquisitionTrends
    });
  } catch (error) {
    console.error('Error fetching analytics insights:', error);
    await pool.end();
    return NextResponse.json(
      { error: 'Failed to fetch analytics insights', success: false },
      { status: 500 }
    );
  }
}
