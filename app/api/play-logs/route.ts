import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { logPlayLogCreated, logPlayLogDeleted } from '@/lib/services/changelog-service';
import { awardPoints, calculatePoints } from '@/lib/services/points-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Initialize database service
    const db = DatabaseService.initialize();

    // Fetch all play logs with game names and staff names from PostgreSQL
    console.log('Fetching play logs with names from PostgreSQL...');
    const logs = await db.playLogs.getAllLogsWithNames();

    console.log(`✅ Fetched ${logs.length} play logs with names from PostgreSQL`);

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('❌ Error fetching play logs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch play logs';

    return NextResponse.json(
      {
        error: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const { gameId, staffListId, sessionDate, notes, durationHours } = await request.json();

    // Validate required fields
    if (!gameId || !staffListId) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, staffListId' },
        { status: 400 }
      );
    }

    // Check for duplicate play logs (1 per game per hour)
    console.log(`[play-logs POST] Checking for recent play logs: game=${gameId}`);
    const recentLogs = await db.playLogs.getLogsByGameId(gameId);

    // Calculate time threshold (1 hour ago)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check if any recent logs exist within the last hour
    const duplicateLog = recentLogs.find(log => {
      const logDate = new Date(log.createdAt);
      return logDate > oneHourAgo;
    });

    if (duplicateLog) {
      console.log(`⚠️ Duplicate play log detected within 1 hour: ${duplicateLog.id}`);
      return NextResponse.json(
        {
          error: 'A play log for this game was already created within the last hour. Please wait before logging again.',
          duplicateLogId: duplicateLog.id,
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Create play log in PostgreSQL
    console.log(`[play-logs POST] Creating play log: game=${gameId}, staff=${staffListId}`);

    const playLog = await db.playLogs.createLog({
      gameId,
      staffListId,
      sessionDate: sessionDate || new Date().toISOString(),
      notes: notes || null,
      durationHours: durationHours || null,
    });

    console.log(`✅ Play log created successfully: ${playLog.id}`);

    // Get game and staff details for changelog and points
    try {
      const gameResult = await db.pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
      const staffResult = await db.pool.query('SELECT staff_name FROM staff_list WHERE id = $1', [staffListId]);

      if (gameResult.rows.length > 0 && staffResult.rows.length > 0) {
        const gameName = gameResult.rows[0].name;
        const staffName = staffResult.rows[0].staff_name;

        // v1.6.6: Award points for play log (this also creates changelog entry)
        await awardPoints({
          staffId: staffListId,
          actionType: 'play_log',
          metadata: {
            gameId,
            gameName  // Include game name for proper entity_name in changelog
          },
          context: `Play log for ${gameName}`
        });

        // Note: Removed logPlayLogCreated() call - awardPoints() already creates changelog entry
      }
    } catch (changelogError) {
      console.error('Failed to log play log creation to changelog or award points:', changelogError);
      // Don't fail the request if changelog logging fails
    }

    return NextResponse.json(
      {
        success: true,
        playLogId: playLog.id,
        log: playLog,
        message: 'Play log created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Error creating play log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create play log';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Get play log details before deleting for changelog and point refund
    const logDetails = await db.pool.query(`
      SELECT g.name as game_name, g.id as game_id, sl.staff_name, sl.id as staff_id
      FROM play_logs pl
      LEFT JOIN games g ON pl.game_id = g.id
      LEFT JOIN staff_list sl ON pl.staff_list_id = sl.id
      WHERE pl.id = $1
    `, [recordId]);

    if (logDetails.rows.length === 0) {
      return NextResponse.json(
        { error: 'Play log not found' },
        { status: 404 }
      );
    }

    const log = logDetails.rows[0];
    const gameName = log.game_name || 'Unknown Game';
    const staffName = log.staff_name || 'Unknown Staff';
    const staffId = log.staff_id || '';
    const gameId = log.game_id || '';

    // v1.6.7: Calculate points to refund dynamically (same as award logic)
    const pointsAwarded = await calculatePoints({
      staffId,
      actionType: 'play_log',
      metadata: { gameId, gameName }
    });
    const pointsToRefund = -pointsAwarded;

    // Log deletion to changelog with negative points
    try {
      const seqResult = await db.pool.query("SELECT nextval('changelog_id_seq') as next_id");
      const changelogId = seqResult.rows[0].next_id;

      await db.pool.query(`
        INSERT INTO changelog (
          id,
          event_type,
          category,
          staff_id,
          entity_id,
          entity_name,
          points_awarded,
          point_category,
          description,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        changelogId,
        'deleted',
        'play_log',
        staffId,
        gameId,
        gameName,
        pointsToRefund,
        'play_log',
        `Play log deleted for ${gameName}`
      ]);

      // Subtract points from staff member
      await db.pool.query(`
        UPDATE staff_list
        SET points = points + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [pointsToRefund, staffId]);

      console.log(`✅ Refunded ${pointsToRefund} points to ${staffName}`);
    } catch (refundError) {
      console.error('Failed to log deletion or refund points:', refundError);
    }

    // Delete record from PostgreSQL
    console.log(`[play-logs DELETE] Deleting play log: ${recordId}`);
    await db.playLogs.deleteLog(recordId);

    console.log(`✅ Play log deleted successfully: ${recordId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Play log deleted successfully and points refunded',
        pointsRefunded: Math.abs(pointsToRefund),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error deleting play log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete play log';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');
    const { sessionDate, notes, durationHours } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Update record in PostgreSQL
    console.log(`[play-logs PATCH] Updating play log: ${recordId}`);

    const updates: any = {};
    if (sessionDate !== undefined) updates.sessionDate = sessionDate;
    if (notes !== undefined) updates.notes = notes;
    if (durationHours !== undefined) updates.durationHours = durationHours;

    const updatedLog = await db.playLogs.updateLog(recordId, updates);

    console.log(`✅ Play log updated successfully: ${recordId}`);

    return NextResponse.json(
      {
        success: true,
        log: updatedLog,
        message: 'Play log updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error updating play log:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update play log';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
