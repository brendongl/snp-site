import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { getCachedGames, setCachedGames } from '@/lib/cache/games-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Try to get games from cache first
    let allGames = getCachedGames();

    // If no cache exists, fetch from Airtable and cache it
    if (!allGames) {
      console.log('Cache miss - fetching from Airtable');
      allGames = await gamesService.getAllGames();
      setCachedGames(allGames);
      console.log(`Cached ${allGames.length} games`);
    } else {
      console.log(`Cache hit - returning ${allGames.length} games`);
    }

    // Get categories for filter options
    const allCategories = gamesService.getAllCategories(allGames);

    return NextResponse.json({
      games: allGames,
      totalCount: allGames.length,
      categories: allCategories,
    });
  } catch (error) {
    console.error('Error in games API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}