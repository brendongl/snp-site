import { ContentCheck } from '@/types';
import { logger } from '@/lib/logger';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const CONTENT_CHECK_TABLE_ID = 'tblHWhNrHc9r3u42Q';
const STAFF_TABLE_ID = 'tblMTy5HcxmTzPMNf';

interface AirtableResponse {
  records: any[];
  offset?: string;
}

/**
 * Fetch staff records and create a map of ID to Name
 */
async function fetchStaffMap(): Promise<Record<string, string>> {
  if (!AIRTABLE_API_KEY) {
    return {};
  }

  try {
    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${STAFF_TABLE_ID}`
    );

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      logger.warn('Content Check', 'Failed to fetch staff records', { status: response.status });
      return {};
    }

    const data: AirtableResponse = await response.json();
    const staffMap: Record<string, string> = {};

    data.records.forEach((record) => {
      if (record.fields['Staff Name']) {
        staffMap[record.id] = record.fields['Staff Name'];
      }
    });

    return staffMap;
  } catch (error) {
    logger.warn('Content Check', 'Error fetching staff map', error instanceof Error ? error : new Error(String(error)));
    return {};
  }
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

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        throw new Error(`Airtable API error: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const data: AirtableResponse = await response.json();
      allRecords.push(...data.records);
      offset = data.offset;
    } while (offset);

    // Fetch staff map to convert Inspector IDs to names
    const staffMap = await fetchStaffMap();

    return allRecords.map((record) => ({
      id: record.id,
      fields: {
        'Record ID': record.fields['Record ID'],
        'Board Game': record.fields['Board Game'],
        'Check Date': record.fields['Check Date'],
        'Inspector': record.fields['Inspector'] && Array.isArray(record.fields['Inspector'])
          ? record.fields['Inspector'].map((id: string) => staffMap[id] || id)
          : record.fields['Inspector'],
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
  logger.info('Content Check', `Fetching content checks for game: ${gameId}`, { gameId });

  try {
    // Fetch all content checks (they're cached) and filter in memory
    // This is more reliable than Airtable's filterByFormula for linked records
    const allChecks = await getAllChecks();

    // Filter for checks that have this game ID in their Board Game array
    const filteredChecks = allChecks.filter(check => {
      const boardGames = check.fields['Board Game'];
      if (!boardGames || !Array.isArray(boardGames)) {
        return false;
      }
      return boardGames.includes(gameId);
    });

    // Sort by Check Date descending (most recent first)
    const sortedChecks = filteredChecks.sort((a, b) => {
      const dateA = a.fields['Check Date'] ? new Date(a.fields['Check Date']).getTime() : 0;
      const dateB = b.fields['Check Date'] ? new Date(b.fields['Check Date']).getTime() : 0;
      return dateB - dateA;
    });

    logger.info('Content Check', `Found ${sortedChecks.length} content checks for game ${gameId}`, { count: sortedChecks.length });

    return sortedChecks;
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
