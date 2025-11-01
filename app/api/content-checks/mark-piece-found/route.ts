import { NextRequest, NextResponse } from 'next/server';
import ContentChecksDbService from '@/lib/services/content-checks-db-service';
import { Pool } from 'pg';

const contentChecksService = new ContentChecksDbService(process.env.DATABASE_URL!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { check_id, pieces_found, notes, inspector_id } = body;

    if (!check_id || !pieces_found || !Array.isArray(pieces_found)) {
      return NextResponse.json(
        { error: 'check_id and pieces_found array are required' },
        { status: 400 }
      );
    }

    if (!inspector_id) {
      return NextResponse.json(
        { error: 'inspector_id is required' },
        { status: 400 }
      );
    }

    // Get the original check to find game_id
    const originalCheckResult = await pool.query(
      'SELECT game_id, missing_pieces FROM content_checks WHERE id = $1',
      [check_id]
    );

    if (originalCheckResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Original check not found' },
        { status: 404 }
      );
    }

    const gameId = originalCheckResult.rows[0].game_id;
    const recoveryNotes = `Pieces recovered: ${pieces_found.join(', ')}${notes ? `\n\n${notes}` : ''}`;

    // Create new piece_recovery check
    const newCheck = await contentChecksService.createCheck({
      gameId,
      inspectorId: inspector_id,
      checkDate: new Date().toISOString(),
      checkType: 'piece_recovery',
      status: ['Perfect Condition'],
      missingPieces: null, // Pieces are now found
      boxCondition: null,
      cardCondition: null,
      isFake: false,
      notes: recoveryNotes,
      sleeved: false,
      boxWrapped: false,
      photos: [],
      hasIssue: false, // v1.2.0: Pieces recovered, no issue
      resolvedById: inspector_id, // v1.2.0: Staff who found the pieces
      resolvedFromCheckId: check_id, // v1.2.0: Link to original check
    });

    return NextResponse.json({
      success: true,
      new_check_id: newCheck.id,
      message: 'Piece recovery recorded successfully',
    });
  } catch (error) {
    console.error('Error marking piece as found:', error);
    return NextResponse.json(
      { error: 'Failed to mark piece as found' },
      { status: 500 }
    );
  }
}
