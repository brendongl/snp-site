import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '5');

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);

    const result = await pool.query(
      `
      WITH latest_checks AS (
        SELECT
          game_id,
          MAX(check_date) as last_checked_date
        FROM content_checks
        GROUP BY game_id
      ),
      plays_since_check AS (
        SELECT
          pl.game_id,
          COUNT(*) as plays_count
        FROM play_logs pl
        LEFT JOIN latest_checks lc ON pl.game_id = lc.game_id
        WHERE pl.session_date > COALESCE(lc.last_checked_date, '1970-01-01'::timestamp)
        GROUP BY pl.game_id
      )
      SELECT
        g.id as game_id,
        g.name as name,
        lc.last_checked_date,
        COALESCE(psc.plays_count, 0) as plays_since_check,
        CASE
          WHEN lc.last_checked_date IS NULL THEN 999999
          ELSE EXTRACT(EPOCH FROM (NOW() - lc.last_checked_date)) / 86400
        END as days_since_check
      FROM games g
      LEFT JOIN latest_checks lc ON g.id = lc.game_id
      LEFT JOIN plays_since_check psc ON g.id = psc.game_id
      WHERE
        lc.last_checked_date IS NULL
        OR lc.last_checked_date < $1
      ORDER BY days_since_check DESC
      LIMIT $2
      `,
      [thresholdDate.toISOString(), limit]
    );

    const actions = result.rows.map((row) => ({
      game_id: row.game_id,
      name: row.name,
      days_since_check: row.last_checked_date
        ? Math.floor(parseFloat(row.days_since_check))
        : null,
      plays_since_check: parseInt(row.plays_since_check),
    }));

    return NextResponse.json({ actions });
  } catch (error) {
    console.error('Error fetching priority actions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch priority actions' },
      { status: 500 }
    );
  }
}
