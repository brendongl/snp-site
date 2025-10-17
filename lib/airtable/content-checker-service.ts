import { ContentCheck } from '@/types';
import { logger } from '@/lib/logger';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const CONTENT_CHECK_TABLE_ID = 'tblHWhNrHc9r3u42Q';

interface AirtableResponse {
  records: any[];
  offset?: string;
}

/**
 * Fetch all content checks from Airtable
 */
export async function getAllChecks(): Promise<ContentCheck[]> {
  if (!AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_API_KEY is not set');
  }

  const allRecords: any[] = [];
  let offset: string | undefined;

  try {
    do {
      const url = new URL(
        `https://api.airtable.com/v0/${BASE_ID}/${CONTENT_CHECK_TABLE_ID}`
      );

      // Sort by Check Date descending (most recent first)
      url.searchParams.append('sort[0][field]', 'Check Date');
      url.searchParams.append('sort[0][direction]', 'desc');

      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`);
      }

      const data: AirtableResponse = await response.json();
      allRecords.push(...data.records);
      offset = data.offset;
    } while (offset);

    return allRecords.map((record) => ({
      id: record.id,
      fields: {
        'Record ID': record.fields['Record ID'],
        'Board Game': record.fields['Board Game'],
        'Check Date': record.fields['Check Date'],
        'Inspector': record.fields['Inspector'],
        'Status': record.fields['Status'],
        'Missing Pieces': record.fields['Missing Pieces'],
        'Box Condition': record.fields['Box Condition'],
        'Card Condition': record.fields['Card Condition'],
        'Is Fake': record.fields['Is Fake'],
        'Notes': record.fields['Notes'],
        'Sleeved At Check': record.fields['Sleeved At Check'],
        'Box Wrapped At Check': record.fields['Box Wrapped At Check'],
        'Photos': record.fields['Photos'],
      },
    }));
  } catch (error) {
    console.error('Error fetching content checks:', error);
    throw error;
  }
}

/**
 * Fetch all content checks for a specific board game
 * @param gameId - The Airtable record ID of the board game
 */
export async function getChecksForGame(gameId: string): Promise<ContentCheck[]> {
  if (!AIRTABLE_API_KEY) {
    throw new Error('AIRTABLE_API_KEY is not set');
  }

  logger.info('Content Check', `Fetching content checks for game: ${gameId}`, { gameId, baseId: BASE_ID, tableId: CONTENT_CHECK_TABLE_ID });

  const allRecords: any[] = [];
  let offset: string | undefined;

  try {
    do {
      const url = new URL(
        `https://api.airtable.com/v0/${BASE_ID}/${CONTENT_CHECK_TABLE_ID}`
      );

      // Filter by Board Game linked record
      // Use FIND to match the exact record ID in the stringified array
      const filterFormula = `FIND("${gameId}", ARRAYJOIN({Board Game}, ","))`;
      url.searchParams.append('filterByFormula', filterFormula);

      logger.debug('Content Check', 'Airtable request URL', { url: url.toString(), filterFormula });

      // Sort by Check Date descending (most recent first)
      url.searchParams.append('sort[0][field]', 'Check Date');
      url.searchParams.append('sort[0][direction]', 'desc');

      if (offset) {
        url.searchParams.append('offset', offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`);
      }

      const data: AirtableResponse = await response.json();
      logger.debug('Content Check', `Fetched ${data.records.length} records`, { count: data.records.length, hasMore: !!data.offset });
      allRecords.push(...data.records);
      offset = data.offset;
    } while (offset);

    logger.info('Content Check', `Total content checks found for game ${gameId}: ${allRecords.length}`, { count: allRecords.length });

    return allRecords.map((record) => ({
      id: record.id,
      fields: {
        'Record ID': record.fields['Record ID'],
        'Board Game': record.fields['Board Game'],
        'Check Date': record.fields['Check Date'],
        'Inspector': record.fields['Inspector'],
        'Status': record.fields['Status'],
        'Missing Pieces': record.fields['Missing Pieces'],
        'Box Condition': record.fields['Box Condition'],
        'Card Condition': record.fields['Card Condition'],
        'Is Fake': record.fields['Is Fake'],
        'Notes': record.fields['Notes'],
        'Sleeved At Check': record.fields['Sleeved At Check'],
        'Box Wrapped At Check': record.fields['Box Wrapped At Check'],
        'Photos': record.fields['Photos'],
      },
    }));
  } catch (error) {
    logger.error('Content Check', 'Error fetching content checks for game', error instanceof Error ? error : new Error(String(error)), { gameId });
    throw error;
  }
}

/**
 * Get the latest content check for a specific board game
 * @param gameId - The Airtable record ID of the board game
 */
export async function getLatestCheckForGame(gameId: string): Promise<ContentCheck | null> {
  const checks = await getChecksForGame(gameId);
  return checks.length > 0 ? checks[0] : null;
}
