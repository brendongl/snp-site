import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import { logger } from '@/lib/logger';

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_GAMES_BASE_ID || '');
const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || '';

export async function GET() {
  try {
    logger.info('Games List', 'Fetching all games from Airtable');

    const records = await base(tableId)
      .select({
        fields: ['Game Name', 'Year Released'],
        sort: [{ field: 'Game Name', direction: 'asc' }],
      })
      .all();

    const games = records.map((record) => ({
      id: record.id,
      name: record.get('Game Name') as string,
      year: record.get('Year Released') as number,
    }));

    logger.info('Games List', `Successfully fetched ${games.length} games`);

    return NextResponse.json({
      success: true,
      games,
    });
  } catch (error) {
    logger.error('Games List', 'Failed to fetch games', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch games',
      },
      { status: 500 }
    );
  }
}
