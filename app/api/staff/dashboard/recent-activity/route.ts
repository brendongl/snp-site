import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get recent content checks and play logs, combine and sort
    const checksResult = await pool.query(
      `
      SELECT
        'check' as type,
        cc.created_at as timestamp,
        sl.staff_name as staff_name,
        g.name as game_name
      FROM content_checks cc
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      LEFT JOIN games g ON cc.game_id = g.id
      ORDER BY cc.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    const logsResult = await pool.query(
      `
      SELECT
        'play' as type,
        pl.created_at as timestamp,
        sl.staff_name as staff_name,
        g.name as game_name
      FROM play_logs pl
      LEFT JOIN staff_list sl ON pl.staff_list_id = sl.stafflist_id
      LEFT JOIN games g ON pl.game_id = g.id
      ORDER BY pl.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    // Combine and sort by timestamp
    const activities = [...checksResult.rows, ...logsResult.rows]
      .filter((row) => row.timestamp && row.game_name) // Filter out invalid entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map((row) => ({
        type: row.type,
        timestamp: row.timestamp,
        staff_name: row.staff_name || 'Unknown',
        game_name: row.game_name || 'Unknown Game',
        action: row.type === 'check' ? 'checked' : 'logged play',
      }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch recent activity',
        details: errorMessage,
        hint: 'Check database tables and columns'
      },
      { status: 500 }
    );
  }
}
