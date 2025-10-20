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
        { error: 'Missing required fields' },
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
    for (const gameId of gameIds) {
      const response = await fetch(
        `https://api.airtable.com/v0/${baseId}/${knowledgeTableId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              'Staff Member': [staffMemberId],
              'Game': [gameId],
              'Confidence Level': confidenceLevel,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create record for game ${gameId}`);
      }

      const data = await response.json();
      createdRecords.push(data);
    }

    return NextResponse.json({
      success: true,
      created: createdRecords.length,
      records: createdRecords,
    });
  } catch (error) {
    console.error('Bulk create API error:', error);
    return NextResponse.json(
      { error: 'Failed to create records' },
      { status: 500 }
    );
  }
}
