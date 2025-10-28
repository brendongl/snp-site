import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

interface MissingPieceEntry {
  piece_description: string;
  game_id: string;
  game_name: string;
  check_id: string;
  reported_by: string;
  reported_date: string;
  notes: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Get all content checks with missing pieces
    const result = await pool.query(
      `
      SELECT
        cc.id as check_id,
        cc.game_id,
        cc.missing_pieces,
        cc.notes,
        cc.check_date,
        cc.inspector_id,
        g.name as game_name,
        sl.staff_name as inspector_name
      FROM content_checks cc
      JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      WHERE cc.missing_pieces IS NOT NULL
        AND cc.missing_pieces != ''
        AND COALESCE(cc.check_type, 'regular') != 'piece_recovery'
      ORDER BY cc.check_date DESC
      `
    );

    // Flatten missing pieces into individual entries
    const missingPieces: MissingPieceEntry[] = [];

    result.rows.forEach((row) => {
      // Parse missing pieces (assuming comma-separated or newline-separated)
      const pieces = row.missing_pieces
        .split(/[,\n]/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      pieces.forEach((piece: string) => {
        missingPieces.push({
          piece_description: piece,
          game_id: row.game_id,
          game_name: row.game_name,
          check_id: row.check_id,
          reported_by: row.inspector_name || 'Unknown',
          reported_date: row.check_date,
          notes: row.notes,
        });
      });
    });

    // Sort alphabetically by piece description
    missingPieces.sort((a, b) =>
      a.piece_description.localeCompare(b.piece_description)
    );

    return NextResponse.json({
      pieces: missingPieces,
      total_pieces: missingPieces.length,
      affected_games: new Set(missingPieces.map((p) => p.game_id)).size,
    });
  } catch (error) {
    console.error('Error fetching missing pieces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing pieces' },
      { status: 500 }
    );
  }
}
