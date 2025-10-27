import { NextRequest, NextResponse } from 'next/server';
import videoGamesDbService from '@/lib/services/video-games-db-service';
import { VideogamePlatform } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/video-games
 * Get all video games, optionally filtered by platform
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as VideogamePlatform | null;
    const search = searchParams.get('search');
    const locatedOn = searchParams.get('locatedOn'); // Comma-separated console names
    const category = searchParams.get('category'); // Comma-separated genres

    let games;

    // Search query
    if (search) {
      games = await videoGamesDbService.searchGames(search, platform || undefined);
    }
    // Filter by location
    else if (locatedOn) {
      const locations = locatedOn.split(',').filter(Boolean);
      games = await videoGamesDbService.getGamesByLocation(locations);
    }
    // Filter by category
    else if (category) {
      const categories = category.split(',').filter(Boolean);
      games = await videoGamesDbService.getGamesByCategory(categories);
    }
    // Platform filter or all games
    else {
      games = await videoGamesDbService.getAllGames(platform || undefined);
    }

    return NextResponse.json({
      games,
      count: games.length,
    });
  } catch (error) {
    console.error('Error fetching video games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video games' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/video-games
 * Create a new video game (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const gameData = await request.json();

    // Basic validation
    if (!gameData.id || !gameData.platform || !gameData.name) {
      return NextResponse.json(
        { error: 'Missing required fields: id, platform, name' },
        { status: 400 }
      );
    }

    const newGame = await videoGamesDbService.createGame(gameData);

    return NextResponse.json({
      game: newGame,
      message: 'Video game created successfully',
    });
  } catch (error) {
    console.error('Error creating video game:', error);
    return NextResponse.json(
      { error: 'Failed to create video game' },
      { status: 500 }
    );
  }
}
