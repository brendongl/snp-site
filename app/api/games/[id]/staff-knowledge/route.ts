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
        sk.confidence_level,
        sk.can_teach
      FROM staff_knowledge sk
      JOIN staff_list sl ON sk.staff_member_id = sl.id
      WHERE sk.game_id = $1
      ORDER BY
        CASE
          WHEN sk.confidence_level = 5 THEN 1
          WHEN sk.confidence_level = 4 THEN 2
          WHEN sk.confidence_level = 3 THEN 3
          WHEN sk.confidence_level = 2 THEN 4
          WHEN sk.confidence_level = 1 THEN 5
        END
      `,
      [gameId]
    );

    // Group by can_teach status
    const knowledge = {
      knows: result.rows.filter((k) => !k.can_teach),
      canTeach: result.rows.filter((k) => k.can_teach),
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
