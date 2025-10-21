import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import DatabaseService from '@/lib/services/db-service';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

export const dynamic = 'force-dynamic';

/**
 * Refresh expired image URL from Airtable
 * Called when we get a 410 Gone error (URL expired)
 */
async function refreshImageUrl(gameId: string, hash: string): Promise<string | null> {
  try {
    console.log(`🔄 Refreshing expired URL for hash ${hash}, game ${gameId}`);

    // Get Airtable API credentials
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
    const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';

    if (!apiKey) {
      console.error('❌ AIRTABLE_API_KEY not set');
      return null;
    }

    // Fetch fresh game record from Airtable
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableId}/${gameId}`;
    const response = await fetch(airtableUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch game from Airtable: ${response.status}`);
      return null;
    }

    const gameData = await response.json();
    const images = gameData.fields?.Images;

    if (!images || images.length === 0) {
      console.error(`❌ No images found in Airtable for game ${gameId}`);
      return null;
    }

    // Find the image with matching hash
    for (const image of images) {
      const imageUrl = image.url;
      if (!imageUrl) continue;

      // Calculate MD5 hash of this URL to match against our hash
      const crypto = require('crypto');
      const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');

      if (urlHash === hash) {
        // Found the matching image! Update database with fresh URL
        const db = DatabaseService.initialize();
        await db.pool.query(
          'UPDATE game_images SET url = $1 WHERE hash = $2',
          [imageUrl, hash]
        );

        console.log(`✅ Refreshed URL for hash ${hash}`);
        return imageUrl;
      }
    }

    console.error(`❌ Could not find matching image for hash ${hash} in Airtable response`);
    return null;
  } catch (error) {
    console.error('❌ Error refreshing image URL:', error);
    return null;
  }
}

/**
 * Download image from URL with optional URL refresh on 410 error
 */
async function downloadImage(
  imageUrl: string,
  gameId: string,
  hash: string,
  allowRefresh: boolean = true
): Promise<{ buffer: Buffer; extension: string; fileName?: string } | null> {
  try {
    console.log(`📥 Downloading image from: ${imageUrl.substring(0, 100)}...`);
    const imageResponse = await fetch(imageUrl);

    // Handle 410 Gone (expired URL)
    if (imageResponse.status === 410 && allowRefresh) {
      console.log(`⚠️  URL expired (410), attempting refresh...`);
      const freshUrl = await refreshImageUrl(gameId, hash);

      if (freshUrl) {
        // Retry download with fresh URL (don't allow refresh again to avoid infinite loop)
        return downloadImage(freshUrl, gameId, hash, false);
      } else {
        console.error('❌ Failed to refresh URL');
        return null;
      }
    }

    if (!imageResponse.ok) {
      console.error(`❌ Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine extension from content-type
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    let extension = '.jpg';
    if (contentType.includes('png')) {
      extension = '.png';
    } else if (contentType.includes('webp')) {
      extension = '.webp';
    } else if (contentType.includes('gif')) {
      extension = '.gif';
    } else if (contentType.includes('svg')) {
      extension = '.svg';
    }

    return { buffer, extension };
  } catch (error) {
    console.error('❌ Error downloading image:', error);
    return null;
  }
}

/**
 * Serve cached image by hash
 * GET /api/images/[hash]
 *
 * Returns cached image file if it exists, otherwise downloads from Airtable
 * Automatically refreshes expired URLs (410 errors)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Validate hash format (should be MD5 hex, 32 chars)
    if (!hash || !/^[a-f0-9]{32}$/.test(hash)) {
      return NextResponse.json(
        { error: 'Invalid image hash format' },
        { status: 400 }
      );
    }

    // Security: Prevent directory traversal
    if (hash.includes('..') || hash.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Ensure cache directory exists (with error handling)
    let canWriteCache = true;
    try {
      if (!fs.existsSync(IMAGE_CACHE_DIR)) {
        fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
      }
    } catch (mkdirError) {
      console.error('⚠️  Cannot create image cache directory (will serve without caching):', mkdirError);
      canWriteCache = false;
    }

    // Look for cached image with any extension (only if cache is accessible)
    let imagePath: string | null = null;
    if (canWriteCache) {
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      for (const ext of extensions) {
        try {
          const potentialPath = path.join(IMAGE_CACHE_DIR, `${hash}${ext}`);
          if (fs.existsSync(potentialPath)) {
            imagePath = potentialPath;
            console.log(`✅ Serving cached image: ${hash}${ext}`);
            break;
          }
        } catch {
          // Ignore errors checking for cached files
        }
      }
    }

    if (!imagePath) {
      // Image not in cache - fetch from database and download
      console.log(`📂 Image ${hash} not in cache, fetching from database...`);

      try {
        // Query database for image URL and game context
        const db = DatabaseService.initialize();
        const result = await db.pool.query(
          'SELECT url, game_id, file_name, created_at FROM game_images WHERE hash = $1 LIMIT 1',
          [hash]
        );

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Image hash not found in database' },
            { status: 404 }
          );
        }

        const { url: imageUrl, game_id: gameId, created_at: createdAt } = result.rows[0];

        // Check if URL might be stale (older than 1 hour)
        // Note: Using created_at as proxy for URL freshness
        const urlAge = Date.now() - new Date(createdAt).getTime();
        const oneHour = 60 * 60 * 1000;
        if (urlAge > oneHour) {
          console.log(`⚠️  URL is ${Math.round(urlAge / 1000 / 60)} minutes old (since creation), might be expired`);
        }

        // Download image (with automatic URL refresh on 410)
        const downloadResult = await downloadImage(imageUrl, gameId, hash);

        if (!downloadResult) {
          return NextResponse.json(
            { error: 'Failed to download image from source' },
            { status: 502 }
          );
        }

        const { buffer, extension } = downloadResult;

        // Try to save to cache (if permissions allow)
        if (canWriteCache) {
          try {
            imagePath = path.join(IMAGE_CACHE_DIR, `${hash}${extension}`);
            fs.writeFileSync(imagePath, buffer);
            console.log(`✅ Cached image to: ${hash}${extension}`);
          } catch (writeError) {
            console.error('⚠️  Failed to write image to cache (will serve without caching):', writeError);
            imagePath = null; // Don't use the path if write failed
          }
        } else {
          console.log('⚠️  Serving image without caching (no write permissions)');
        }

        // Serve the downloaded image
        const mimeTypeMap: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
        };

        const mimeType = mimeTypeMap[extension] || 'application/octet-stream';

        return new NextResponse(buffer as any, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"${hash}"`,
          },
        });
      } catch (downloadError) {
        console.error('❌ Error downloading and caching image:', downloadError);
        return NextResponse.json(
          { error: 'Failed to fetch and cache image' },
          { status: 500 }
        );
      }
    }

    // Read and serve cached image
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(imagePath).toLowerCase();

    // Determine MIME type
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };

    const mimeType = mimeTypeMap[ext] || 'application/octet-stream';

    // Set cache headers - 1 year for immutable hashed content
    const response = new NextResponse(imageBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${hash}"`,
      },
    });

    return response;
  } catch (error) {
    console.error('❌ Error serving cached image:', error);

    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
