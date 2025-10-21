import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { cacheImage, getCacheStats, clearImageCache } from '@/lib/cache/image-cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cache - Get cache statistics
 * POST /api/cache - Trigger image caching for all games
 */

export async function GET(request: Request) {
  try {
    const stats = getCacheStats();
    
    return NextResponse.json({
      status: 'ok',
      cache: stats,
      message: `${stats.totalImages} images cached, ${stats.totalSizeMB} MB used`,
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = DatabaseService.initialize();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'cache-all';

    if (action === 'cache-all') {
      // Cache all game images
      console.log('Starting image cache operation for all games...');

      const allGames = await db.games.getAllGames();
      let cachedCount = 0;
      let errorCount = 0;

      for (const game of allGames) {
        // Get game images from database
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

      const stats = getCacheStats();

      return NextResponse.json({
        status: 'completed',
        cachedCount,
        errorCount,
        stats,
        message: `Cached ${cachedCount} images (${stats.totalSizeMB} MB), ${errorCount} errors`,
      });
    } else if (action === 'clear') {
      // Clear cache
      const cleared = clearImageCache();

      return NextResponse.json({
        status: cleared ? 'cleared' : 'error',
        message: cleared ? 'Cache cleared successfully' : 'Failed to clear cache',
      });
    } else {
      return NextResponse.json(
        { error: 'Unknown action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Cache operation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
