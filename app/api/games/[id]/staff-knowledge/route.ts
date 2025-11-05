import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;

    const result = await pool.query(
      `
      SELECT
        sl.id as staff_id,
        sl.nickname,
        sl.staff_name,
        sk.expertise_level,
        sk.can_teach,
        sk.confidence_level
      FROM staff_knowledge sk
      JOIN staff_list sl ON sk.staff_list_id = sl.id
      WHERE sk.game_record_id = $1
      ORDER BY
        CASE sk.expertise_level
          WHEN 'instructor' THEN 1
          WHEN 'expert' THEN 2
          WHEN 'intermediate' THEN 3
          WHEN 'beginner' THEN 4
        END
      `,
      [gameId]
    );

    // Group by expertise
    const knowledge = {
      knows: result.rows.filter(
        (k) => k.expertise_level === 'beginner' || k.expertise_level === 'intermediate'
      ),
      canTeach: result.rows.filter(
        (k) => k.expertise_level === 'expert' || k.expertise_level === 'instructor'
      ),
    };

    return NextResponse.json(knowledge);
  } catch (error) {
    console.error('[API] Error fetching staff knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff knowledge' },
      { status: 500 }
    );
  }
}
