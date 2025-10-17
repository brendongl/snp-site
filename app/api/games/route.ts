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

    // If no cache exists, fetch from Airtable and cache it
    if (!allGames) {
      console.log('Cache miss - fetching from Airtable');
      allGames = await gamesService.getAllGames();
      setCachedGames(allGames);
      console.log(`Cached ${allGames.length} games`);

      // Start background image caching (don't await)
      cacheGameImages(allGames).catch(err =>
        console.error('Error in background image caching:', err)
      );
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