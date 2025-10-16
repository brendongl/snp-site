import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allGames = await gamesService.getAllGames();
    const randomGame = gamesService.getRandomGame(allGames);

    if (!randomGame) {
      return NextResponse.json(
        { error: 'No games available' },
        { status: 404 }
      );
    }

    return NextResponse.json(randomGame);
  } catch (error) {
    console.error('Error getting random game:', error);
    return NextResponse.json(
      { error: 'Failed to get random game' },
      { status: 500 }
    );
  }
}