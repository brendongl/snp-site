import { NextRequest, NextResponse } from 'next/server';
import videoGamesDbService from '@/lib/services/video-games-db-service';
import { VideogamePlatform } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/video-games/[id]
 * Get a single video game by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const platform = (searchParams.get('platform') as VideogamePlatform) || 'switch';

    const game = await videoGamesDbService.getGameById(id, platform);

    if (!game) {
      return NextResponse.json(
        { error: 'Video game not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error('Error fetching video game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video game' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/video-games/[id]
 * Update a video game (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updates = await request.json();
    const { searchParams } = new URL(request.url);
    const platform = (searchParams.get('platform') as VideogamePlatform) || 'switch';

    const updatedGame = await videoGamesDbService.updateGame(id, platform, updates);

    return NextResponse.json({
      game: updatedGame,
      message: 'Video game updated successfully',
    });
  } catch (error) {
    console.error('Error updating video game:', error);
    return NextResponse.json(
      { error: 'Failed to update video game' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/video-games/[id]
 * Delete a video game (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const platform = (searchParams.get('platform') as VideogamePlatform) || 'switch';

    const deleted = await videoGamesDbService.deleteGame(id, platform);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Video game not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Video game deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting video game:', error);
    return NextResponse.json(
      { error: 'Failed to delete video game' },
      { status: 500 }
    );
  }
}
