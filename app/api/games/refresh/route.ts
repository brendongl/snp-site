import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { cacheImage } from '@/lib/cache/image-cache';

/**
 * Refresh endpoint for syncing data
 * Now uses PostgreSQL as primary source
 * POST /api/games/refresh
 *
 * Query params:
 * - ?full=true - Force recache all images
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const forceFullRefresh = url.searchParams.get('full') === 'true';

    // Initialize database
    const db = DatabaseService.initialize();

    // Get all games from PostgreSQL
    console.log('Fetching games from PostgreSQL for refresh...');
    const games = await db.games.getAllGames();

    if (forceFullRefresh) {
      console.log('Starting image cache refresh for all games...');

      // Cache all images (non-blocking for performance)
      (async () => {
        let cachedCount = 0;
        let errorCount = 0;

        for (const game of games) {
          const images = await db.games.getGameImages(game.id);

          for (const image of images) {
            try {
              const result = await cacheImage(image.url, game.id);
              if (result) {
                cachedCount++;
              }
            } catch (error) {
              console.error(`Failed to cache image ${image.url}:`, error);
              errorCount++;
            }
          }
        }

        console.log(`Image caching complete: ${cachedCount} cached, ${errorCount} errors`);
      })().catch(err => console.error('Error in background image caching:', err));

      return NextResponse.json({
        success: true,
        message: 'Games loaded from PostgreSQL, image caching started in background',
        type: 'full',
        gamesCount: games.length,
        source: 'postgresql',
      });
    }

    // Regular refresh - just return current game count
    return NextResponse.json({
      success: true,
      message: 'Games data current from PostgreSQL',
      type: 'check',
      gamesCount: games.length,
      source: 'postgresql',
    });
  } catch (error) {
    console.error('Error in refresh endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Refresh failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
