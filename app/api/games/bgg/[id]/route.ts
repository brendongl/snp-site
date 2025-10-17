import { NextResponse } from 'next/server';
import { fetchBGGGame } from '@/lib/services/bgg-api';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params for Next.js 15
    const { id } = await params;

    logger.info('BGG Route', `Received request for BGG ID: ${id}`);

    const gameId = parseInt(id);

    if (isNaN(gameId) || gameId <= 0) {
      logger.warn('BGG Route', `Invalid BGG ID provided: ${id}`);
      return NextResponse.json(
        { error: 'Invalid BGG ID' },
        { status: 400 }
      );
    }

    logger.info('BGG Route', `Fetching game data for ID: ${gameId}`);
    const gameData = await fetchBGGGame(gameId);

    logger.info('BGG Route', `Successfully fetched game: ${gameData.name}`);
    return NextResponse.json({
      success: true,
      data: gameData,
    });
  } catch (error) {
    logger.error('BGG Route', 'Failed to fetch BGG game', error as Error, {
      url: request.url,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error('Error fetching BGG game:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch game from BoardGameGeek',
      },
      { status: 500 }
    );
  }
}
