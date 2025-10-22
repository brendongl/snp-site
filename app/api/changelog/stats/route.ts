import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * GET /api/changelog/stats
 *
 * Get analytics data for charts
 *
 * Query params:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - groupBy: day, week, month (default: day)
 * - compareStaff: comma-separated staff IDs (optional, max 2)
 * - includePreviousPeriod: true/false (optional)
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

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'day';
    const compareStaffParam = searchParams.get('compareStaff');
    const compareStaff = compareStaffParam ? compareStaffParam.split(',').slice(0, 2) : [];
    const includePreviousPeriod = searchParams.get('includePreviousPeriod') === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Get changes by day
    const changesByDayQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE event_type = 'created') as created,
        COUNT(*) FILTER (WHERE event_type = 'updated') as updated,
        COUNT(*) FILTER (WHERE event_type = 'deleted') as deleted,
        COUNT(*) FILTER (WHERE event_type = 'photo_added') as photo_added
      FROM changelog
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `;

    const endDatePlusOne = new Date(endDate);
    endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);

    const changesByDayResult = await pool.query(changesByDayQuery, [
      startDate,
      endDatePlusOne.toISOString(),
    ]);

    const changesByDay = changesByDayResult.rows.map((row) => ({
      date: row.date,
      created: parseInt(row.created || '0'),
      updated: parseInt(row.updated || '0'),
      deleted: parseInt(row.deleted || '0'),
      photo_added: parseInt(row.photo_added || '0'),
    }));

    // Get changes by category
    const changesByCategoryQuery = `
      SELECT
        COUNT(*) FILTER (WHERE category = 'board_game') as board_game,
        COUNT(*) FILTER (WHERE category = 'play_log') as play_log,
        COUNT(*) FILTER (WHERE category = 'staff_knowledge') as staff_knowledge,
        COUNT(*) FILTER (WHERE category = 'content_check') as content_check
      FROM changelog
      WHERE created_at >= $1 AND created_at < $2
    `;

    const changesByCategoryResult = await pool.query(changesByCategoryQuery, [
      startDate,
      endDatePlusOne.toISOString(),
    ]);

    const changesByCategory = {
      board_game: parseInt(changesByCategoryResult.rows[0].board_game || '0'),
      play_log: parseInt(changesByCategoryResult.rows[0].play_log || '0'),
      staff_knowledge: parseInt(changesByCategoryResult.rows[0].staff_knowledge || '0'),
      content_check: parseInt(changesByCategoryResult.rows[0].content_check || '0'),
    };

    // Get changes by staff
    const changesByStaffQuery = `
      SELECT
        staff_member as staff_name,
        COUNT(*) as total_changes
      FROM changelog
      WHERE created_at >= $1 AND created_at < $2
        AND staff_member IS NOT NULL
      GROUP BY staff_member
      ORDER BY total_changes DESC
      LIMIT 10
    `;

    const changesByStaffResult = await pool.query(changesByStaffQuery, [
      startDate,
      endDatePlusOne.toISOString(),
    ]);

    const changesByStaff = changesByStaffResult.rows.map((row) => ({
      staffName: row.staff_name,
      totalChanges: parseInt(row.total_changes || '0'),
    }));

    // Get overall stats
    const stats = {
      totalChanges: changesByDay.reduce((sum, day) => sum + day.created + day.updated + day.deleted + day.photo_added, 0),
      gameUpdates: changesByCategory.board_game,
      playLogsAdded: changesByCategory.play_log,
      knowledgeUpdates: changesByCategory.staff_knowledge,
      contentChecks: changesByCategory.content_check,
    };

    // NEW: Get staff-grouped activity over time
    let changesByStaffOverTime: any[] = [];
    if (compareStaff.length > 0) {
      const staffActivityQuery = `
        SELECT
          DATE(created_at) as date,
          staff_id,
          staff_member as staff_name,
          COUNT(*) as total_actions
        FROM changelog
        WHERE created_at >= $1 AND created_at < $2
          AND staff_id = ANY($3)
        GROUP BY DATE(created_at), staff_id, staff_member
        ORDER BY DATE(created_at) ASC, staff_name ASC
      `;

      const staffActivityResult = await pool.query(staffActivityQuery, [
        startDate,
        endDatePlusOne.toISOString(),
        compareStaff
      ]);

      changesByStaffOverTime = staffActivityResult.rows.map(row => ({
        date: row.date,
        staffId: row.staff_id,
        staffName: row.staff_name,
        totalActions: parseInt(row.total_actions || '0')
      }));
    }

    // NEW: Get staff knowledge counts for pie chart
    const staffKnowledgeQuery = `
      SELECT
        sl.staff_name,
        COUNT(*) as knowledge_count
      FROM staff_knowledge sk
      INNER JOIN staff_list sl ON sk.staff_member_id = sl.stafflist_id
      GROUP BY sl.staff_name
      ORDER BY knowledge_count DESC
    `;

    const staffKnowledgeResult = await pool.query(staffKnowledgeQuery);
    const staffKnowledgeCounts = staffKnowledgeResult.rows.map(row => ({
      staffName: row.staff_name,
      knowledgeCount: parseInt(row.knowledge_count || '0')
    }));

    // NEW: Get weighted contributions (content checks * 3, photos * 2, play logs * 1)
    const weightedContributionsQuery = `
      SELECT
        staff_member as staff_name,
        COUNT(*) FILTER (WHERE category = 'content_check' AND event_type = 'created') as content_checks,
        COUNT(*) FILTER (WHERE category = 'board_game' AND event_type = 'photo_added') as photos,
        COUNT(*) FILTER (WHERE category = 'play_log' AND event_type = 'created') as play_logs,
        (COUNT(*) FILTER (WHERE category = 'content_check' AND event_type = 'created') * 3) +
        (COUNT(*) FILTER (WHERE category = 'board_game' AND event_type = 'photo_added') * 2) +
        (COUNT(*) FILTER (WHERE category = 'play_log' AND event_type = 'created') * 1) as total_score
      FROM changelog
      WHERE created_at >= $1 AND created_at < $2
        AND staff_member IS NOT NULL
      GROUP BY staff_member
      HAVING (
        COUNT(*) FILTER (WHERE category = 'content_check' AND event_type = 'created') +
        COUNT(*) FILTER (WHERE category = 'board_game' AND event_type = 'photo_added') +
        COUNT(*) FILTER (WHERE category = 'play_log' AND event_type = 'created')
      ) > 0
      ORDER BY total_score DESC
      LIMIT 10
    `;

    const weightedContributionsResult = await pool.query(weightedContributionsQuery, [
      startDate,
      endDatePlusOne.toISOString()
    ]);

    const weightedContributions = weightedContributionsResult.rows.map(row => ({
      staffName: row.staff_name,
      contentChecks: parseInt(row.content_checks || '0'),
      photos: parseInt(row.photos || '0'),
      playLogs: parseInt(row.play_logs || '0'),
      totalScore: parseInt(row.total_score || '0')
    }));

    // NEW: Get previous period stats for comparison (if requested)
    let previousStats = null;
    if (includePreviousPeriod) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const periodLengthMs = end.getTime() - start.getTime();

      const prevStart = new Date(start.getTime() - periodLengthMs);
      const prevEnd = start;

      const prevStatsQuery = `
        SELECT
          COUNT(*) FILTER (WHERE category = 'board_game') as game_updates,
          COUNT(*) FILTER (WHERE category = 'play_log') as play_logs_added,
          COUNT(*) FILTER (WHERE category = 'staff_knowledge') as knowledge_updates,
          COUNT(*) FILTER (WHERE category = 'content_check') as content_checks,
          COUNT(*) as total_changes
        FROM changelog
        WHERE created_at >= $1 AND created_at < $2
      `;

      const prevStatsResult = await pool.query(prevStatsQuery, [
        prevStart.toISOString(),
        prevEnd.toISOString()
      ]);

      previousStats = {
        totalChanges: parseInt(prevStatsResult.rows[0].total_changes || '0'),
        gameUpdates: parseInt(prevStatsResult.rows[0].game_updates || '0'),
        playLogsAdded: parseInt(prevStatsResult.rows[0].play_logs_added || '0'),
        knowledgeUpdates: parseInt(prevStatsResult.rows[0].knowledge_updates || '0'),
        contentChecks: parseInt(prevStatsResult.rows[0].content_checks || '0')
      };
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      stats,
      previousStats,
      changesByDay,
      changesByCategory,
      changesByStaff,
      changesByStaffOverTime,
      staffKnowledgeCounts,
      weightedContributions
    });
  } catch (error) {
    console.error('Error fetching changelog stats:', error);
    await pool.end();
    return NextResponse.json(
      { error: 'Failed to fetch changelog stats', success: false },
      { status: 500 }
    );
  }
}
