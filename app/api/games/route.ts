import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { getCachedGames, setCachedGames } from '@/lib/cache/games-cache';
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
    // Try to get games from cache first
    let allGames = getCachedGames();
    let shouldRefreshCache = false;

    // Check if cache needs refresh (older than 1 hour for URL freshness)
    if (allGames) {
      const metadata = require('@/lib/cache/games-cache').getCacheMetadata();
      if (metadata.lastUpdated) {
        const cacheAge = Date.now() - new Date(metadata.lastUpdated).getTime();
        const oneHour = 60 * 60 * 1000;
        if (cacheAge > oneHour) {
          console.log('Cache is stale (>1 hour old) - refreshing for fresh Airtable URLs');
          shouldRefreshCache = true;
        }
      }
    }

    // If no cache exists or cache is stale, fetch from Airtable and cache it
    if (!allGames || shouldRefreshCache) {
      try {
        console.log('Fetching fresh games from Airtable');
        allGames = await gamesService.getAllGames();
        setCachedGames(allGames);
        console.log(`Cached ${allGames.length} games with fresh URLs`);

        // Start background image caching (don't await)
        cacheGameImages(allGames).catch(err =>
          console.error('Error in background image caching:', err)
        );
      } catch (fetchError) {
        // If fresh fetch fails, fall back to cached data if available
        if (allGames) {
          console.warn('Failed to fetch fresh games, using cached data:', fetchError);
        } else {
          // No cache and fetch failed
          throw fetchError;
        }
      }
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