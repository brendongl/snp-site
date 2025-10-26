import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import DatabaseService from '@/lib/services/db-service';
import { logContentCheckCreated } from '@/lib/services/changelog-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.initialize();

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
    if (!gameId || !inspector || !status || !boxCondition || !cardCondition || missingPieces === undefined) {
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

    // Create content check in PostgreSQL
    const contentCheck = await db.contentChecks.createCheck({
      gameId,
      inspectorId: inspector,
      checkDate,
      status: Array.isArray(status) ? status : [status],
      boxCondition,
      cardCondition,
      missingPieces: missingPieces || null, // TEXT field, not boolean
      isFake: false,
      notes: notes || null,
      sleeved: sleevedAtCheck || false,
      boxWrapped: boxWrappedAtCheck || false,
      photos: [],
    });

    logger.info('Content Check', 'Content check created successfully in PostgreSQL', {
      recordId: contentCheck.id,
    });

    // Get game and staff details for changelog
    try {
      const gameResult = await db.pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
      const staffResult = await db.pool.query('SELECT staff_name FROM staff_list WHERE stafflist_id = $1', [inspector]);

      if (gameResult.rows.length > 0 && staffResult.rows.length > 0) {
        const gameName = gameResult.rows[0].name;
        const staffName = staffResult.rows[0].staff_name;

        await logContentCheckCreated(
          contentCheck.id,
          gameName,
          staffName,
          inspector,
          Array.isArray(status) ? status[0] : status,
          notes
        );
      }
    } catch (changelogError) {
      logger.error('Content Check', 'Failed to log to changelog', changelogError instanceof Error ? changelogError : new Error(String(changelogError)));
      // Don't fail the request if changelog logging fails
    }

    return NextResponse.json({
      success: true,
      contentCheckId: contentCheck.id,
      record: contentCheck,
      message: 'Content check created successfully',
    }, { status: 201 });
  } catch (error) {
    logger.error('Content Check', 'Error creating content check', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to create content check' },
      { status: 500 }
    );
  }
}
