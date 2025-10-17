import { NextRequest, NextResponse } from 'next/server';
import { cacheImage, hashUrl, getCachedImagePath } from '@/lib/cache/image-cache';
import { gamesService } from '@/lib/airtable/games-service';
import fs from 'fs';

/**
 * Extracts game ID from Airtable image URL
 */
function extractGameIdFromUrl(url: string): string | null {
  // Airtable URLs don't directly contain game IDs, but we can try to extract from context
  // For now, we'll rely on the fallback mechanism
  return null;
}

/**
 * Finds a fresh image URL for a game by searching Airtable
 */
async function getFreshImageUrl(originalUrl: string): Promise<string | null> {
  try {
    // Try to get fresh data from Airtable
    const allGames = await gamesService.getAllGames();

    // Search for the first image URL in any game that matches
    // Since we don't have the game ID, we'll return the first available image
    for (const game of allGames) {
      const firstImage = game.fields.Images?.[0];
      const imageUrl = firstImage?.thumbnails?.large?.url || firstImage?.url;
      if (imageUrl) {
        return imageUrl;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching fresh image URL from Airtable:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Hash the URL to check if already cached
    const urlHash = hashUrl(url);
    let imagePath = getCachedImagePath(urlHash);

    // If not cached, try to cache it now
    if (!imagePath) {
      const cached = await cacheImage(url);
      if (cached) {
        imagePath = getCachedImagePath(urlHash);
      }
    }

    // If still no cached path, try direct proxy
    if (!imagePath) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        // If we get a 410 (Gone) error, try to get a fresh URL from Airtable
        if (response.status === 410) {
          console.warn(`Image URL expired (410): ${url}. Attempting to fetch fresh URL from Airtable.`);
          const freshUrl = await getFreshImageUrl(url);

          if (freshUrl) {
            // Try to fetch and cache the fresh URL
            const freshResponse = await fetch(freshUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            if (freshResponse.ok) {
              const buffer = await freshResponse.arrayBuffer();
              const contentType = freshResponse.headers.get('content-type') || 'image/jpeg';

              // Cache the fresh image
              await cacheImage(freshUrl);

              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=3600',
                },
              });
            }
          }

          // Fallback: return placeholder or error
          return NextResponse.json(
            { error: 'Image expired and could not refresh' },
            { status: 410 }
          );
        }

        if (!response.ok) {
          console.warn(`Failed to fetch image from ${url}: ${response.status}`);
          return NextResponse.json(
            { error: 'Failed to fetch image' },
            { status: response.status }
          );
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        console.error(`Error proxying image from ${url}:`, error);
        return NextResponse.json(
          { error: 'Failed to fetch image' },
          { status: 500 }
        );
      }
    }

    // Return cached image
    if (!fs.existsSync(imagePath)) {
      return NextResponse.json(
        { error: 'Cached image not found' },
        { status: 404 }
      );
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };

    const contentType = contentTypeMap[ext || 'jpg'] || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error in image proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
