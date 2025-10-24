import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

export const dynamic = 'force-dynamic';

/**
 * Serve image by hash from disk
 * GET /api/images/[hash]
 *
 * Simple approach: Images are pre-populated to Railway volume via migration script.
 * This endpoint just serves files from disk - no Airtable dependency, no expiring URLs.
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

    // Look for image with any extension
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
      // Silently return 404 for missing images - don't log errors
      // This is expected behavior when images haven't been cached yet
      return NextResponse.json(
        { error: 'Image not found' },
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
    console.error('❌ Error serving image:', error);

    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
