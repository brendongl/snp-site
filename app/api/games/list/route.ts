import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import DatabaseService from '@/lib/services/db-service';

export async function GET() {
  try {
    logger.info('Games List', 'Fetching all games from PostgreSQL');

    const db = DatabaseService.getInstance();
    const allGames = await db.games.getAllGames();

    // Map to the format expected by AddGameDialog
    const games = allGames.map((game) => ({
      id: game.id,
      name: game.fields['Game Name'] as string,
      year: game.fields['Year Released'] as number,
    }));

    logger.info('Games List', `Successfully fetched ${games.length} games`);

    return NextResponse.json({
      success: true,
      games,
    });
  } catch (error) {
    logger.error('Games List', 'Failed to fetch games', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch games',
      },
      { status: 500 }
    );
  }
}
