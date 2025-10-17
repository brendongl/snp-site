import { NextRequest, NextResponse } from 'next/server';
import { cacheImage, hashUrl, getCachedImagePath } from '@/lib/cache/image-cache';
import fs from 'fs';

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
