import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = await gamesService.getGameById(id);

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }

    console.log('Game delete request received:', { gameId });

    // Delete from PostgreSQL (this will cascade delete related records)
    const db = DatabaseService.initialize();
    await db.games.deleteGame(gameId);

    return NextResponse.json({
      success: true,
      message: 'Game deleted successfully',
      gameId,
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete game';

    return NextResponse.json(
      { error: errorMsg, success: false },
      { status: 500 }
    );
  }
}