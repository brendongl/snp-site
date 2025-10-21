import { ContentCheck } from '@/types';
import { logger } from '@/lib/logger';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const CONTENT_CHECK_TABLE_ID = 'tblHWhNrHc9r3u42Q';
const GAMES_TABLE_ID = 'tblIuIJN5q3W6oXNr';
const STAFF_TABLE_ID = 'tblMTy5HcxmTzPMNf';

// Simple cache for game name lookups
let gameNameCache: Record<string, string> = {};

interface AirtableResponse {
  records: any[];
  offset?: string;
}

/**
 * Fetch a game name by ID
 */
async function getGameName(gameId: string): Promise<string> {
  if (gameNameCache[gameId]) {
    return gameNameCache[gameId];
  }

  if (!AIRTABLE_API_KEY) {
    logger.warn('Content Check', 'AIRTABLE_API_KEY not set, cannot fetch game name');
    return 'Unknown Game';
  }

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${GAMES_TABLE_ID}/${gameId}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const name = data.fields['Game Name'] || 'Unknown Game';
      gameNameCache[gameId] = name;
      logger.debug('Content Check', `Resolved game ID ${gameId} to "${name}"`);
      return name;
    } else {
      logger.warn('Content Check', `Failed to fetch game ${gameId}`, { status: response.status });
    }
  } catch (error) {
    logger.warn('Content Check', `Error fetching game ${gameId}`, error instanceof Error ? error : new Error(String(error)));
  }

  return 'Unknown Game';
}

/**
 * Fetch staff records and create a map of ID to Name
 */
async function fetchStaffMap(): Promise<Record<string, string>> {
  if (!AIRTABLE_API_KEY) {
    logger.warn('Content Check', 'AIRTABLE_API_KEY not set, skipping staff name mapping');
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
      logger.warn('Content Check', 'Failed to fetch staff records', { status: response.status, statusText: response.statusText });
      return {};
    }

    const data: AirtableResponse = await response.json();
    const staffMap: Record<string, string> = {};

    data.records.forEach((record) => {
      if (record.fields['Staff Name']) {
        staffMap[record.id] = record.fields['Staff Name'];
        logger.debug('Content Check', `Mapped staff ID ${record.id} to ${record.fields['Staff Name']}`);
      }
    });

    logger.info('Content Check', `Successfully fetched ${data.records.length} staff records, mapped ${Object.keys(staffMap).length} names`);
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
    logger.info('Content Check', `Processing ${allRecords.length} content check records with staff map`);

    return Promise.all(allRecords.map(async (record) => {
      let inspectorNames: string[] | undefined;
      if (record.fields['Inspector'] && Array.isArray(record.fields['Inspector'])) {
        inspectorNames = record.fields['Inspector'].map((id: string) => staffMap[id] || id);
        if (inspectorNames.length > 0 && inspectorNames[0].startsWith('rec')) {
          logger.warn('Content Check', `Record ${record.id} has unmapped inspector IDs: ${inspectorNames.join(', ')}`);
        }
      }

      // Resolve game names from Board Game linked record IDs
      let gameNames: string[] | undefined;
      if (record.fields['Board Game'] && Array.isArray(record.fields['Board Game'])) {
        gameNames = await Promise.all(
          record.fields['Board Game'].map((gameId: string) => getGameName(gameId))
        );
      }

      return {
        id: record.id,
        fields: {
          'Record ID': record.fields['Record ID'],
          'Board Game': gameNames || record.fields['Board Game'],
          'Check Date': record.fields['Check Date'],
          'Inspector': inspectorNames || record.fields['Inspector'],
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
      };
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
