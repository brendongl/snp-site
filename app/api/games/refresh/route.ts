import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { setCachedGames, getCacheMetadata, mergeGamesIntoCache } from '@/lib/cache/games-cache';

export async function POST(request: Request) {
  try {
    const oldCache = getCacheMetadata();
    const url = new URL(request.url);
    const forceFullRefresh = url.searchParams.get('full') === 'true';

    // If no cache exists or force full refresh, fetch all games
    if (!oldCache.lastUpdated || forceFullRefresh) {
      console.log('Performing full refresh from Airtable...');
      const games = await gamesService.getAllGames();
      setCachedGames(games);

      console.log(`Full cache refresh complete: ${games.length} games`);

      return NextResponse.json({
        success: true,
        message: 'Full cache refresh completed',
        type: 'full',
        count: games.length,
        previousCount: oldCache.count,
        previousUpdate: oldCache.lastUpdated,
        currentUpdate: new Date().toISOString(),
      });
    }

    // Otherwise, perform incremental refresh
    console.log(`Performing incremental refresh since: ${oldCache.lastUpdated}`);
    const updatedGames = await gamesService.getUpdatedGames(oldCache.lastUpdated);

    if (updatedGames.length === 0) {
      console.log('No updates found');
      return NextResponse.json({
        success: true,
        message: 'Cache is already up to date',
        type: 'incremental',
        updatedCount: 0,
        totalCount: oldCache.count,
        previousUpdate: oldCache.lastUpdated,
        currentUpdate: new Date().toISOString(),
      });
    }

    // Merge updated games into existing cache
    mergeGamesIntoCache(updatedGames);
    const newCache = getCacheMetadata();

    console.log(`Incremental refresh complete: ${updatedGames.length} games updated`);

    return NextResponse.json({
      success: true,
      message: `Incremental refresh completed: ${updatedGames.length} games updated`,
      type: 'incremental',
      updatedCount: updatedGames.length,
      totalCount: newCache.count,
      previousCount: oldCache.count,
      previousUpdate: oldCache.lastUpdated,
      currentUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    return NextResponse.json(
      { error: 'Failed to refresh cache' },
      { status: 500 }
    );
  }
}
