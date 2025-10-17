import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const CONTENT_CHECK_TABLE_ID = 'tblHWhNrHc9r3u42Q';

export async function POST(request: NextRequest) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      gameId,
      inspector,
      status,
      boxCondition,
      cardCondition,
      missingPieces,
      notes,
      sleevedAtCheck,
      boxWrappedAtCheck,
    } = body;

    // Validation
    if (!gameId || !inspector || !status || !boxCondition || !cardCondition || !missingPieces) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    logger.info('Content Check', 'Creating new content check', {
      gameId,
      inspector,
      status,
    });

    // Get today's date in ISO format
    const checkDate = new Date().toISOString().split('T')[0];

    // Create the content check record
    const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${CONTENT_CHECK_TABLE_ID}`;

    const recordData = {
      fields: {
        'Board Game': [gameId], // Link to board game record
        'Inspector': [inspector], // Link to inspector record
        'Check Date': checkDate,
        'Status': status,
        'Box Condition': boxCondition,
        'Card Condition': cardCondition,
        'Missing Pieces': missingPieces,
        'Notes': notes || '',
        'Sleeved At Check': sleevedAtCheck,
        'Box Wrapped At Check': boxWrappedAtCheck,
      },
    };

    logger.debug('Content Check', 'Airtable request payload', { recordData });

    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Content Check', 'Airtable API error', new Error(errorText), {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();
    logger.info('Content Check', 'Content check created successfully', {
      recordId: data.id,
    });

    return NextResponse.json({
      success: true,
      record: data,
    });
  } catch (error) {
    logger.error('Content Check', 'Error creating content check', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to create content check' },
      { status: 500 }
    );
  }
}
