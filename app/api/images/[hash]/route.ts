import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    hash: string;
  };
}

/**
 * Serve cached image by hash
 * GET /api/images/[hash]
 *
 * Returns cached image file if it exists
 * Supports cache-busting with ?v= query parameter
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { hash } = params;

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
      // Image not in cache - this is okay, frontend can use original URL
      return NextResponse.json(
        { error: 'Image not found in cache' },
        { status: 404 }
      );
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
    console.error(`Error serving cached image ${params.hash}:`, error);

    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
