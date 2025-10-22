import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

/**
 * GET /api/changelog
 *
 * Fetch paginated changelog entries with filters
 *
 * Query params:
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - staffId: Filter by staff member
 * - eventType: created, updated, deleted, photo_added
 * - category: board_game, play_log, staff_knowledge, content_check
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
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
    const staffId = searchParams.get('staffId');
    const eventType = searchParams.get('eventType');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const offset = (page - 1) * limit;

    // Build WHERE clause dynamically
    const conditions = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      // Add one day to endDate to include all entries on that day
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      conditions.push(`created_at < $${paramIndex++}`);
      params.push(endDatePlusOne.toISOString());
    }
    if (staffId) {
      conditions.push(`staff_id = $${paramIndex++}`);
      params.push(staffId);
    }
    if (eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(eventType);
    }
    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    const whereClause = conditions.join(' AND ');

    // Fetch data
    const dataQuery = `
      SELECT * FROM changelog
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total FROM changelog
      WHERE ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);

    // Get summary stats
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE category = 'board_game') as game_updates,
        COUNT(*) FILTER (WHERE category = 'play_log') as play_logs_added,
        COUNT(*) FILTER (WHERE category = 'staff_knowledge') as knowledge_updates,
        COUNT(*) FILTER (WHERE category = 'content_check') as content_checks
      FROM changelog
      WHERE ${whereClause}
    `;

    const statsResult = await pool.query(statsQuery, params.slice(0, -2));
    const stats = {
      totalChanges: totalItems,
      gameUpdates: parseInt(statsResult.rows[0].game_updates || '0'),
      playLogsAdded: parseInt(statsResult.rows[0].play_logs_added || '0'),
      knowledgeUpdates: parseInt(statsResult.rows[0].knowledge_updates || '0'),
      contentChecks: parseInt(statsResult.rows[0].content_checks || '0'),
    };

    await pool.end();

    return NextResponse.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
      stats,
    });
  } catch (error) {
    console.error('Error fetching changelog:', error);
    await pool.end();
    return NextResponse.json(
      { error: 'Failed to fetch changelog', success: false },
      { status: 500 }
    );
  }
}
