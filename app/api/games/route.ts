import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { getCachedGames, setCachedGames, isCacheOlderThan } from '@/lib/cache/games-cache';
import { cacheImage, getCachedImage } from '@/lib/cache/image-cache';

export const dynamic = 'force-dynamic';

// Background job to cache images (non-blocking)
async function cacheGameImages(games: any[]) {
  console.log(`Starting background image caching for ${games.length} games`);
  let cachedCount = 0;
  let skippedCount = 0;

  for (const game of games) {
    const firstImage = game.fields.Images?.[0];
    const imageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;

    if (imageUrl) {
      // Check if already cached
      const cached = getCachedImage(imageUrl);
      if (cached) {
        skippedCount++;
      } else {
        // Cache the image
        const result = await cacheImage(imageUrl);
        if (result) {
          cachedCount++;
        }
      }
    }
  }

  console.log(`Image caching complete: ${cachedCount} new, ${skippedCount} already cached`);
}

export async function GET(request: Request) {
  try {
    // Cache-first strategy with 1 hour TTL
    // Airtable image URLs expire after ~12 hours, so 1 hour is safe
    const ONE_HOUR_MS = 60 * 60 * 1000;

    let allGames = getCachedGames();
    const cacheStale = isCacheOlderThan(ONE_HOUR_MS);

    if (allGames && !cacheStale) {
      console.log(`Cache hit - returning ${allGames.length} games (cache age: ${Date.now() - new Date(require('@/lib/cache/games-cache').getCacheMetadata().lastUpdated).getTime()}ms)`);
      const allCategories = gamesService.getAllCategories(allGames);
      return NextResponse.json({
        games: allGames,
        totalCount: allGames.length,
        categories: allCategories,
      });
    }

    // Cache miss or stale - fetch fresh from Airtable
    console.log(cacheStale ? 'Cache is stale (>1 hour) - refreshing from Airtable' : 'Cache miss - fetching from Airtable');
    allGames = await gamesService.getAllGames();

    // Cache for subsequent requests
    setCachedGames(allGames);
    console.log(`Fetched and cached ${allGames.length} games from Airtable`);

    // Start background image caching (don't await)
    cacheGameImages(allGames).catch(err =>
      console.error('Error in background image caching:', err)
    );

    // Get categories for filter options
    const allCategories = gamesService.getAllCategories(allGames);

    return NextResponse.json({
      games: allGames,
      totalCount: allGames.length,
      categories: allCategories,
    });
  } catch (error) {
    console.error('Error in games API:', error);

    // If fetch fails, try to use cache as fallback (even if stale)
    try {
      console.warn('Failed to fetch from Airtable, attempting to use cache as fallback');
      const cachedGames = getCachedGames();
      if (cachedGames && cachedGames.length > 0) {
        console.log(`Fallback: returning ${cachedGames.length} cached games (may have expired URLs)`);
        const allCategories = gamesService.getAllCategories(cachedGames);
        return NextResponse.json({
          games: cachedGames,
          totalCount: cachedGames.length,
          categories: allCategories,
        });
      }
    } catch (fallbackError) {
      console.error('Fallback cache retrieval also failed:', fallbackError);
    }

    // All options failed
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch games';
    const errorCause = (error as any)?.cause?.code;
    const isTimeout = errorMessage.includes('aborted') ||
                      errorMessage.includes('ETIMEDOUT') ||
                      errorCause === 'ETIMEDOUT' ||
                      errorMessage.includes('fetch failed');

    return NextResponse.json(
      {
        error: isTimeout
          ? 'Network timeout - Cannot reach Airtable API. Please check Docker network settings (try Host mode or add DNS servers).'
          : errorMessage
      },
      { status: 500 }
    );
  }
}