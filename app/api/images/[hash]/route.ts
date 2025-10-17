import { NextRequest, NextResponse } from 'next/server';
import { getCachedImagePath, cacheImage, hashUrl } from '@/lib/cache/image-cache';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;

    // Check if this is actually a URL (for direct proxying)
    const url = request.nextUrl.searchParams.get('url');

    let imagePath: string | null = null;
    let urlHash = hash;

    if (url) {
      // Direct URL proxy mode - cache on the fly
      urlHash = hashUrl(url);
      imagePath = getCachedImagePath(urlHash);

      if (!imagePath) {
        // Not cached yet, download and cache it now
        const cached = await cacheImage(url);
        if (cached) {
          imagePath = getCachedImagePath(urlHash);
        } else {
          // Failed to cache, proxy the original
          const response = await fetch(url);
          const buffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type') || 'image/jpeg';

          return new NextResponse(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    } else {
      // Hash-based lookup
      imagePath = getCachedImagePath(hash);
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Read image file
    const imageBuffer = fs.readFileSync(imagePath);

    // Determine content type from file extension
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

    // Return image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error serving cached image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
