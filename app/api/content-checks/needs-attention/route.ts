import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    // v1.2.0: Get games where the LATEST content check has hasIssue=true
    // Uses DISTINCT ON to get only the most recent check per game
    const result = await pool.query(`
      SELECT DISTINCT ON (cc.game_id)
        cc.game_id,
        cc.missing_pieces as issue_description,
        g.name as game_name,
        cc.id as check_id,
        sl.staff_name as reported_by,
        cc.check_date as reported_date,
        cc.notes
      FROM content_checks cc
      INNER JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.id
      WHERE cc.has_issue = true
      ORDER BY cc.game_id, cc.check_date DESC, cc.created_at DESC
    `);

    return NextResponse.json({
      success: true,
      issues: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching games needing attention:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games needing attention' },
      { status: 500 }
    );
  }
}
