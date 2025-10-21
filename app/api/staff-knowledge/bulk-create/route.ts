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
    'Proficient': 3,
    'Expert': 4,
  };
  return levelMap[level] || 1; // Default to Beginner if unknown
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
          canTeach: confidenceLevel === 'Expert' || confidenceLevel === 'Proficient',
          notes: null,
        });

        createdRecords.push(knowledge);
        console.log(`✅ Knowledge entry created: ${knowledge.id}`);
      } catch (gameError) {
        const errorMsg = gameError instanceof Error ? gameError.message : String(gameError);
        failedGames.push({
          gameId,
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
