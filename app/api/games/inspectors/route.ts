import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const INSPECTORS_TABLE_ID = 'tblGIyQNmhcsK4Qlg';

export async function GET() {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    logger.info('Inspectors', 'Fetching inspectors list');

    const url = new URL(
      `https://api.airtable.com/v0/${BASE_ID}/${INSPECTORS_TABLE_ID}`
    );

    // Sort by name
    url.searchParams.append('sort[0][field]', 'Name');
    url.searchParams.append('sort[0][direction]', 'asc');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
      // Add cache control to allow caching for 5 minutes
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Inspectors', 'Airtable API error', new Error(errorText), {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Map to simple format
    const inspectors = data.records.map((record: any) => ({
      id: record.id,
      name: record.fields.Name || 'Unknown',
    }));

    logger.info('Inspectors', `Fetched ${inspectors.length} inspectors`);

    return NextResponse.json({
      inspectors,
    });
  } catch (error) {
    logger.error('Inspectors', 'Error fetching inspectors', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch inspectors' },
      { status: 500 }
    );
  }
}
