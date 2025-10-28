/**
 * Serve video game images from persistent volume
 * GET /api/video-games/cached-images/[filename]
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const VOLUME_PATH = process.env.VOLUME_PATH || path.join(process.cwd(), 'data', 'video-game-images');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Validate filename (only alphanumeric, dash, underscore, and .jpg/.png/.webp)
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Construct full path
    const filepath = path.join(VOLUME_PATH, filename);

    // Check if file exists locally
    let buffer: Buffer;
    try {
      await fs.access(filepath);
      buffer = await fs.readFile(filepath);
    } catch {
      // File not found locally - this is expected during initial deployment
      // Return a 404 so Next.js Image can fall back to original URL
      return NextResponse.json(
        { error: 'Image not cached yet' },
        { status: 404 }
      );
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' :
                       ext === '.webp' ? 'image/webp' :
                       'image/jpeg';

    // Return image with aggressive caching
    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('[Video Game Cached Images] Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
