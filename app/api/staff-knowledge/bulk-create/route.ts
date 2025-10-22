import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

interface BulkCreateRequest {
  staffMemberId: string;
  gameIds: string[];
  confidenceLevel: string;
}

// Map confidence level string to number
function mapConfidenceLevelToNumber(level: string): number {
  const levelMap: { [key: string]: number } = {
    'Beginner': 1,
    'Intermediate': 2,
    'Expert': 3,
    'Instructor': 4,
  };

  // Throw error if confidence level is not recognized instead of defaulting
  if (!levelMap[level]) {
    throw new Error(`Invalid confidence level: ${level}. Must be one of: Beginner, Intermediate, Expert, Instructor`);
  }

  return levelMap[level];
}

export async function POST(req: Request) {
  try {
    const body: BulkCreateRequest = await req.json();
    const { staffMemberId, gameIds, confidenceLevel } = body;

    if (!staffMemberId || !gameIds || gameIds.length === 0 || !confidenceLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: staffMemberId, gameIds (array), confidenceLevel' },
        { status: 400 }
      );
    }

    const db = DatabaseService.initialize();

    // Convert confidence level string to number
    const confidenceLevelNum = mapConfidenceLevelToNumber(confidenceLevel);

    // Get staff name first
    const staffResult = await db.pool.query(
      'SELECT staff_name FROM staff_list WHERE stafflist_id = $1 LIMIT 1',
      [staffMemberId]
    );
    const staffName = staffResult.rows[0]?.staff_name || 'Unknown Staff';

    // Create records for each game
    const createdRecords = [];
    const failedGames = [];

    for (const gameId of gameIds) {
      try {
        console.log(`[bulk-create] Creating knowledge entry: staff=${staffMemberId}, game=${gameId}`);

        const knowledge = await db.staffKnowledge.createKnowledge({
          staffMemberId,
          gameId,
          confidenceLevel: confidenceLevelNum,
          canTeach: confidenceLevel === 'Expert' || confidenceLevel === 'Instructor',
          taughtBy: null,
          notes: null,
        });

        // Fetch game name to include in response
        const gameResult = await db.pool.query(
          'SELECT name FROM games WHERE id = $1 LIMIT 1',
          [gameId]
        );
        const gameName = gameResult.rows[0]?.name || 'Unknown Game';

        createdRecords.push({
          ...knowledge,
          gameName,
          staffName,
        });
        console.log(`✅ Knowledge entry created: ${knowledge.id}`);
      } catch (gameError) {
        const errorMsg = gameError instanceof Error ? gameError.message : String(gameError);

        // Try to get game name for failed record too
        let failedGameName = 'Unknown Game';
        try {
          const gameResult = await db.pool.query(
            'SELECT name FROM games WHERE id = $1 LIMIT 1',
            [gameId]
          );
          failedGameName = gameResult.rows[0]?.name || failedGameName;
        } catch {
          // Ignore if we can't fetch game name
        }

        failedGames.push({
          gameId,
          gameName: failedGameName,
          error: errorMsg,
        });
        console.error(`❌ Failed to create knowledge entry for game ${gameId}:`, errorMsg);
      }
    }

    // If any games failed, return partial success with details
    if (failedGames.length > 0) {
      const partialSuccess = createdRecords.length > 0;
      return NextResponse.json(
        {
          success: partialSuccess,
          created: createdRecords.length,
          failed: failedGames.length,
          records: createdRecords,
          failedGames,
          message: partialSuccess
            ? `Created ${createdRecords.length} records, but ${failedGames.length} failed`
            : `All ${gameIds.length} records failed to create`,
        },
        { status: partialSuccess ? 207 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: createdRecords.length,
      records: createdRecords,
    });
  } catch (error) {
    console.error('Bulk create API error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to create records';
    return NextResponse.json(
      {
        error: errorMsg,
        success: false,
      },
      { status: 500 }
    );
  }
}
