import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Initialize database service
    const db = DatabaseService.initialize();

    // Fetch all play logs from PostgreSQL
    console.log('Fetching play logs from PostgreSQL...');
    const logs = await db.playLogs.getAllLogs();

    console.log(`✅ Fetched ${logs.length} play logs from PostgreSQL`);

    // Transform to response format
    const formattedLogs = logs.map(log => ({
      id: log.id,
      gameId: log.gameId,
      staffListId: log.staffListId,
      sessionDate: log.sessionDate,
      notes: log.notes,
      durationHours: log.durationHours,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    }));

    return NextResponse.json({
      logs: formattedLogs,
      count: formattedLogs.length,
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

    // Delete record from PostgreSQL
    console.log(`[play-logs DELETE] Deleting play log: ${recordId}`);
    await db.playLogs.deleteLog(recordId);

    console.log(`✅ Play log deleted successfully: ${recordId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Play log deleted successfully',
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
