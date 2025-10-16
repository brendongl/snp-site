import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { GameFilters, SortOption } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Get all games from Airtable
    const allGames = await gamesService.getAllGames();

    // Parse filters from query parameters
    const filters: GameFilters = {
      search: searchParams.get('search') || undefined,
      categories: searchParams.get('categories')?.split(',').filter(Boolean),
      yearRange: {
        min: searchParams.get('yearMin') ? Number(searchParams.get('yearMin')) : undefined,
        max: searchParams.get('yearMax') ? Number(searchParams.get('yearMax')) : undefined,
      },
      playerCount: {
        min: searchParams.get('playerMin') ? Number(searchParams.get('playerMin')) : undefined,
        max: searchParams.get('playerMax') ? Number(searchParams.get('playerMax')) : undefined,
      },
      complexity: {
        min: searchParams.get('complexityMin') ? Number(searchParams.get('complexityMin')) : undefined,
        max: searchParams.get('complexityMax') ? Number(searchParams.get('complexityMax')) : undefined,
      },
      quickFilter: searchParams.get('quickFilter') as 'sixPlus' | 'couples' | 'party' | undefined,
    };

    // Apply filters
    let filteredGames = gamesService.filterGames(allGames, filters);

    // Apply sorting
    const sortOption = (searchParams.get('sort') as SortOption) || 'dateAcquired';
    filteredGames = gamesService.sortGames(filteredGames, sortOption);

    // Get categories for filter options
    const allCategories = gamesService.getAllCategories(allGames);

    return NextResponse.json({
      games: filteredGames,
      totalCount: filteredGames.length,
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