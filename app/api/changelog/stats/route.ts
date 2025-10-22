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

    await pool.end();

    return NextResponse.json({
      success: true,
      stats,
      changesByDay,
      changesByCategory,
      changesByStaff,
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
