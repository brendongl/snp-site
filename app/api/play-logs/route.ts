import { NextResponse } from 'next/server';
import { checkRecentPlayLog, cachePlayLog } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_GAMES_BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const AIRTABLE_PLAY_LOGS_TABLE_ID = process.env.AIRTABLE_PLAY_LOGS_TABLE_ID || 'tblggfqeM2zQaDUEI';
const AIRTABLE_GAMES_TABLE_ID = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblGIyQNmhcsK4Qlg';

// Simple cache for lookups
let gameNameCache: Record<string, string> = {};
let staffNameCache: Record<string, string> = {};

async function getGameName(gameId: string): Promise<string> {
  if (gameNameCache[gameId]) return gameNameCache[gameId];

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_GAMES_TABLE_ID}/${gameId}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      }
    );
    if (response.ok) {
      const data = await response.json();
      const name = data.fields['Game Name'] || 'Unknown Game';
      gameNameCache[gameId] = name;
      return name;
    }
  } catch (error) {
    console.error(`Error fetching game ${gameId}:`, error);
  }
  return 'Unknown Game';
}

async function getStaffName(staffId: string): Promise<string> {
  if (staffNameCache[staffId]) return staffNameCache[staffId];

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}/${staffId}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      }
    );
    if (response.ok) {
      const data = await response.json();
      const name = data.fields['Name'] || 'Unknown Staff';
      staffNameCache[staffId] = name;
      return name;
    }
  } catch (error) {
    console.error(`Error fetching staff ${staffId}:`, error);
  }
  return 'Unknown Staff';
}

export async function GET(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    // Fetch play logs from Airtable
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_PLAY_LOGS_TABLE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Airtable records to our format with lookups
    const logs = await Promise.all(
      (data.records || []).map(async (record: any) => {
        const gameId = record.fields['Game']?.[0] || '';
        const staffId = record.fields['Logged By']?.[0] || '';

        return {
          id: record.id,
          gameId,
          gameName: gameId ? await getGameName(gameId) : 'Unknown Game',
          playedBy: staffId ? await getStaffName(staffId) : 'Unknown Staff',
          playDate: record.fields['Session Date'] || '',
          notes: record.fields['Notes'] || '',
        };
      })
    );

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Error in play logs API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch play logs';

    return NextResponse.json(
      {
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    const { gameId, staffRecordId, staffName, sessionDate, notes } = await request.json();

    // Validate required fields
    if (!gameId || !staffRecordId || !staffName) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, staffRecordId, staffName' },
        { status: 400 }
      );
    }

    // Check PostgreSQL for recent play log (faster than Airtable)
    let recentLog;
    try {
      recentLog = await checkRecentPlayLog(gameId);
    } catch (dbError) {
      console.error('Database error checking recent play log:', dbError);
      // Don't fail - allow the log to be created if DB check fails
    }

    if (recentLog) {
      return NextResponse.json(
        {
          success: false,
          error: `This game has already been logged by ${recentLog.staffName} ${recentLog.minutesAgo} minute${recentLog.minutesAgo !== 1 ? 's' : ''} ago!`,
        },
        { status: 409 } // Conflict status
      );
    }

    // Create record in Airtable Play Logs table
    const airtableResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_PLAY_LOGS_TABLE_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                'Game': [gameId],
                'Logged By': [staffRecordId],
                'Session Date': sessionDate || new Date().toISOString(),
                'Notes': notes || '',
              },
            },
          ],
        }),
      }
    );

    if (!airtableResponse.ok) {
      const errorData = await airtableResponse.json();
      throw new Error(`Airtable API error: ${errorData.error?.message || airtableResponse.statusText}`);
    }

    const airtableData = await airtableResponse.json();
    const playLogId = airtableData.records[0]?.id;

    // Cache the play log in PostgreSQL (non-blocking)
    try {
      await cachePlayLog(gameId, staffName);
    } catch (cacheError) {
      console.error('Error caching play log:', cacheError);
      // Don't fail if caching fails - the record was created in Airtable
    }

    return NextResponse.json(
      {
        success: true,
        playLogId,
        message: 'Play log created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating play log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create play log';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Delete record from Airtable
    const deleteResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_PLAY_LOGS_TABLE_ID}/${recordId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json().catch(() => ({}));
      throw new Error(`Airtable API error: ${(errorData as any).error?.message || deleteResponse.statusText}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Play log deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting play log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete play log';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');
    const { sessionDate, notes } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Update record in Airtable
    const updateResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_PLAY_LOGS_TABLE_ID}/${recordId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            ...(sessionDate && { 'Session Date': sessionDate }),
            ...(notes !== undefined && { 'Notes': notes }),
          },
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      throw new Error(`Airtable API error: ${(errorData as any).error?.message || updateResponse.statusText}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Play log updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating play log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update play log';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
