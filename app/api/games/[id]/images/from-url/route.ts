import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logPhotoAdded } from '@/lib/services/changelog-service';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

/**
 * Download and cache an image from a URL
 * Returns the hash of the cached image
 */
async function downloadAndCacheImage(imageUrl: string): Promise<{ hash: string; fileName: string } | null> {
  try {
    // Ensure cache directory exists
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
    }

    // Download image
    console.log(`[URL Image Download] Downloading image from: ${imageUrl}`);
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`[URL Image Download] Failed to download image: ${response.status}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('md5').update(buffer).digest('hex');

    // Detect file extension from URL or content-type
    const urlParts = imageUrl.split('?')[0]; // Remove query params
    const urlExtension = urlParts.split('.').pop()?.toLowerCase() || '';
    const contentType = response.headers.get('content-type') || '';

    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    let extension = validExtensions.includes(urlExtension) ? urlExtension : null;

    if (!extension) {
      // Fallback to content-type
      const typeMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
      };
      extension = typeMap[contentType] || 'jpg';
    }

    const fileName = `${hash}.${extension}`;
    const filePath = path.join(IMAGE_CACHE_DIR, fileName);

    // Check if already cached
    if (fs.existsSync(filePath)) {
      console.log(`[URL Image Download] Image already cached: ${hash}`);
      return { hash, fileName };
    }

    // Save to disk
    fs.writeFileSync(filePath, buffer);
    console.log(`[URL Image Download] Successfully cached image: ${hash}, size: ${buffer.length} bytes`);

    return { hash, fileName };
  } catch (error) {
    console.error(`[URL Image Download] Error downloading/caching image:`, error);
    return null;
  }
}

/**
 * POST /api/games/[id]/images/from-url
 * Download and add images from URLs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database configuration missing' },
      { status: 500 }
    );
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { id: gameId } = await params;
    console.log(`[URL Image Upload] Starting URL upload for game: ${gameId}`);

    const body = await request.json();
    const { urls, staffId, staffName } = body as {
      urls: string[];
      staffId?: string;
      staffName?: string;
    };

    if (!urls || urls.length === 0) {
      console.log('[URL Image Upload] No URLs provided');
      return NextResponse.json({ error: 'No URLs provided' }, { status: 400 });
    }

    console.log(`[URL Image Upload] Received ${urls.length} URLs`);
    const uploadedHashes: string[] = [];
    const failedUrls: string[] = [];

    for (const imageUrl of urls) {
      console.log(`[URL Image Upload] Processing URL: ${imageUrl}`);

      // Download and cache the image
      const result = await downloadAndCacheImage(imageUrl);

      if (!result) {
        console.warn(`[URL Image Upload] Failed to download/cache: ${imageUrl}`);
        failedUrls.push(imageUrl);
        continue;
      }

      const { hash, fileName } = result;

      // Insert into database
      try {
        await pool.query(
          `
          INSERT INTO game_images (game_id, hash, file_name, url)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (game_id, hash) DO NOTHING
          `,
          [gameId, hash, fileName, `/api/images/${hash}`]
        );
        console.log(`[URL Image Upload] Database record created for hash: ${hash}`);
        uploadedHashes.push(hash);
      } catch (dbError) {
        console.error(`[URL Image Upload] Database error:`, dbError);
        failedUrls.push(imageUrl);
      }
    }

    // Log to changelog if any images were successfully added
    if (uploadedHashes.length > 0) {
      try {
        const gameResult = await pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
        const gameName = gameResult.rows.length > 0 ? gameResult.rows[0].name : 'Unknown Game';

        await logPhotoAdded(
          gameId,
          gameName,
          staffName || 'System',
          staffId || 'system',
          uploadedHashes.length
        );
      } catch (changelogError) {
        console.error('Failed to log photo addition to changelog:', changelogError);
      }
    }

    await pool.end();

    console.log(`[URL Image Upload] Successfully uploaded ${uploadedHashes.length} images, ${failedUrls.length} failed`);

    return NextResponse.json({
      success: true,
      uploadedCount: uploadedHashes.length,
      hashes: uploadedHashes,
      failedUrls: failedUrls.length > 0 ? failedUrls : undefined,
    });
  } catch (error) {
    console.error('[URL Image Upload] Upload failed:', error);
    await pool.end();
    return NextResponse.json(
      {
        error: 'Failed to upload images from URLs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
