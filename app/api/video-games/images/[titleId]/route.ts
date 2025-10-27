import { NextRequest, NextResponse } from 'next/server';
import { videoGameImagesService } from '@/lib/services/video-game-images-service';
import { VideogamePlatform } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/video-games/images/[titleId]?type=landscape&platform=switch
 * Serve cached video game images
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ titleId: string }> }
) {
  try {
    const { titleId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'landscape' | 'portrait' || 'landscape';
    const platform = (searchParams.get('platform') as VideogamePlatform) || 'switch';

    // Try to load image from cache
    const imageBuffer = await videoGameImagesService.loadImage(titleId, platform, type);

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Return image with proper headers
    return new NextResponse(imageBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Error serving video game image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}
