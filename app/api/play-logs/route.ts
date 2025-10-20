import { NextResponse } from 'next/server';

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
