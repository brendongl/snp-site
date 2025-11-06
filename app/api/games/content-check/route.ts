import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import DatabaseService from '@/lib/services/db-service';
import { awardPoints } from '@/lib/services/points-service';

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
      hasIssue, // v1.2.0
      resolvedById, // v1.2.0
      resolvedFromCheckId, // v1.2.0
    } = body;

    // Validation - missingPieces and notes are optional
    const missingFields = [];
    if (!gameId) missingFields.push('gameId');
    if (!inspector) missingFields.push('inspector');
    if (!status) missingFields.push('status');
    if (!boxCondition) missingFields.push('boxCondition');
    if (!cardCondition) missingFields.push('cardCondition');

    if (missingFields.length > 0) {
      const errorDetails = {
        error: 'Missing required fields',
        missingFields,
        receivedData: {
          gameId: !!gameId,
          inspector: !!inspector,
          status: !!status,
          boxCondition: !!boxCondition,
          cardCondition: !!cardCondition,
          missingPieces: missingPieces !== undefined ? 'provided' : 'not provided',
          notes: notes !== undefined ? 'provided' : 'not provided',
        },
      };
      logger.error('Content Check', 'Validation failed', new Error(JSON.stringify(errorDetails)));
      return NextResponse.json(errorDetails, { status: 400 });
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
      hasIssue: hasIssue || false, // v1.2.0
      resolvedById: resolvedById || null, // v1.2.0
      resolvedFromCheckId: resolvedFromCheckId || null, // v1.2.0
    });

    logger.info('Content Check', 'Content check created successfully in PostgreSQL', {
      recordId: contentCheck.id,
    });

    // v1.3.0: Update game's latest check data and increment total checks
    try {
      await db.pool.query(
        `UPDATE games
         SET latest_check_date = $1,
             latest_check_status = $2,
             total_checks = COALESCE(total_checks, 0) + 1,
             updated_at = NOW()
         WHERE id = $3`,
        [checkDate, Array.isArray(status) ? status[0] : status, gameId]
      );
      logger.info('Content Check', 'Updated game latest check data', { gameId, checkDate });
    } catch (updateError) {
      logger.error('Content Check', 'Failed to update game latest check data', updateError instanceof Error ? updateError : new Error(String(updateError)));
      // Don't fail the request if game update fails
    }

    // Get game and staff details for changelog and points award
    let pointsAwarded = 0;
    try {
      const gameResult = await db.pool.query('SELECT name, complexity FROM games WHERE id = $1', [gameId]);
      const staffResult = await db.pool.query('SELECT staff_name FROM staff_list WHERE id = $1', [inspector]);

      if (gameResult.rows.length > 0 && staffResult.rows.length > 0) {
        const gameName = gameResult.rows[0].name;
        const gameComplexity = gameResult.rows[0].complexity || 1;
        const staffName = staffResult.rows[0].staff_name;

        // Award points for content check (1000 × complexity)
        // This also logs to changelog with proper category
        const pointsResult = await awardPoints({
          staffId: inspector,
          actionType: 'content_check',
          metadata: {
            gameId,
            gameComplexity
          },
          context: `Content check for ${gameName}`
        });

        if (pointsResult.success) {
          pointsAwarded = pointsResult.pointsAwarded;
          logger.info('Content Check', `Awarded ${pointsAwarded} points to ${staffName}`, {
            gameId,
            gameName,
            complexity: gameComplexity
          });
        }
      }
    } catch (changelogError) {
      logger.error('Content Check', 'Failed to log to changelog or award points', changelogError instanceof Error ? changelogError : new Error(String(changelogError)));
      // Don't fail the request if changelog logging or points award fails
    }

    return NextResponse.json({
      success: true,
      contentCheckId: contentCheck.id,
      record: contentCheck,
      pointsAwarded,
      message: `Content check created successfully${pointsAwarded > 0 ? ` and ${pointsAwarded} points awarded` : ''}`,
    }, { status: 201 });
  } catch (error) {
    logger.error('Content Check', 'Error creating content check', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to create content check' },
      { status: 500 }
    );
  }
}
