import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { Pool } from 'pg';
import { logContentCheckCreated } from '@/lib/services/changelog-service';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
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

    const payload = { records: [recordData] };
    logger.debug('Content Check', 'Airtable request payload', { payload });

    const response = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

    // Log to changelog
    if (DATABASE_URL) {
      const pool = new Pool({ connectionString: DATABASE_URL });
      try {
        const gameResult = await pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
        const staffResult = await pool.query('SELECT staff_name FROM staff_list WHERE stafflist_id = $1', [inspector]);

        const gameName = gameResult.rows.length > 0 ? gameResult.rows[0].name : 'Unknown Game';
        const staffName = staffResult.rows.length > 0 ? staffResult.rows[0].staff_name : 'Unknown Staff';

        await logContentCheckCreated(
          data.records?.[0]?.id || data.id,
          gameName,
          staffName,
          inspector,
          status,
          notes
        );
      } catch (changelogError) {
        logger.error('Content Check', 'Failed to log to changelog', changelogError instanceof Error ? changelogError : new Error(String(changelogError)));
      } finally {
        await pool.end();
      }
    }

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
