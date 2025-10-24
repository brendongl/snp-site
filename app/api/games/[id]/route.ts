import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch from PostgreSQL with images
    const db = DatabaseService.initialize();
    const game = await db.games.getGameById(id);

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Fetch images for this game
    const images = await db.games.getGameImages(id);

    // Return game with images
    return NextResponse.json({
      success: true,
      game: {
        ...game,
        images,
      },
    });
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