import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface BulkCreateRequest {
  staffMemberId: string;
  gameIds: string[];
  confidenceLevel: string;
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

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_GAMES_BASE_ID;
    const knowledgeTableId = process.env.AIRTABLE_STAFF_KNOWLEDGE_TABLE_ID;

    if (!apiKey || !baseId || !knowledgeTableId) {
      throw new Error('Missing Airtable configuration');
    }

    // Create records for each game
    const createdRecords = [];
    const failedGames = [];

    for (const gameId of gameIds) {
      try {
        const response = await fetch(
          `https://api.airtable.com/v0/${baseId}/${knowledgeTableId}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              records: [{
                fields: {
                  'Staff Member': [staffMemberId],
                  'Game': [gameId],
                  'Confidence Level': confidenceLevel,
                },
              }],
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = (errorData as any).error?.message || response.statusText;
          failedGames.push({
            gameId,
            error: errorMessage,
            status: response.status,
          });
          continue;
        }

        const data = await response.json();
        createdRecords.push(data.records?.[0] || data);
      } catch (gameError) {
        const errorMsg = gameError instanceof Error ? gameError.message : String(gameError);
        failedGames.push({
          gameId,
          error: errorMsg,
        });
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
