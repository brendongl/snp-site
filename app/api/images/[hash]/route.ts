import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import DatabaseService from '@/lib/services/db-service';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

export const dynamic = 'force-dynamic';

/**
 * Serve cached image by hash
 * GET /api/images/[hash]
 *
 * Returns cached image file if it exists
 */
export async function GET(
  request: NextRequest,
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

    // Ensure cache directory exists
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
    }

    // Look for cached image with any extension
    // (md5 hash + .jpg/png/gif/webp)
    const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    let imagePath: string | null = null;

    for (const ext of extensions) {
      const potentialPath = path.join(IMAGE_CACHE_DIR, `${hash}${ext}`);
      if (fs.existsSync(potentialPath)) {
        imagePath = potentialPath;
        break;
      }
    }

    if (!imagePath) {
      // Image not in cache - fetch from database and download
      console.log(`Image ${hash} not in cache, fetching from database...`);

      try {
        // Query database for image URL
        const db = DatabaseService.initialize();
        const result = await db.pool.query(
          'SELECT url, file_name FROM game_images WHERE hash = $1 LIMIT 1',
          [hash]
        );

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Image hash not found in database' },
            { status: 404 }
          );
        }

        const { url: imageUrl, file_name: fileName } = result.rows[0];

        // Download image from Airtable
        console.log(`Downloading image from: ${imageUrl}`);
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
          console.error(`Failed to download image: ${imageResponse.status}`);
          return NextResponse.json(
            { error: 'Failed to download image from source' },
            { status: 502 }
          );
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine extension from fileName or content-type
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        let extension = '.jpg';
        if (fileName) {
          extension = path.extname(fileName);
        } else if (contentType.includes('png')) {
          extension = '.png';
        } else if (contentType.includes('webp')) {
          extension = '.webp';
        } else if (contentType.includes('gif')) {
          extension = '.gif';
        }

        // Save to cache
        imagePath = path.join(IMAGE_CACHE_DIR, `${hash}${extension}`);
        fs.writeFileSync(imagePath, buffer);
        console.log(`Cached image to: ${imagePath}`);

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

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"${hash}"`,
          },
        });
      } catch (downloadError) {
        console.error('Error downloading and caching image:', downloadError);
        return NextResponse.json(
          { error: 'Failed to fetch and cache image' },
          { status: 500 }
        );
      }
    }

    // Read and serve image
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
    const response = new NextResponse(imageBuffer, {
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
    console.error('Error serving cached image:', error);

    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
