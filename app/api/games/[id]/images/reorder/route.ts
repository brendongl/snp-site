import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { logGameUpdate } from '@/lib/services/changelog-service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { imageHashes, staffId, staffName } = await request.json();
    const { id: gameId } = await params;

    if (!gameId || !imageHashes || !Array.isArray(imageHashes)) {
      return NextResponse.json(
        { error: 'Game ID and image hashes array required' },
        { status: 400 }
      );
    }

    console.log(`🔄 Reordering ${imageHashes.length} images for game ${gameId}`);

    // Update the position of each image based on its index in the array
    for (let i = 0; i < imageHashes.length; i++) {
      const hash = imageHashes[i];
      const position = i + 1; // 1-based indexing

      await pool.query(
        `UPDATE game_images
         SET position = $1
         WHERE game_id = $2 AND hash = $3`,
        [position, gameId, hash]
      );
    }

    // Log to changelog
    try {
      const gameResult = await pool.query(
        'SELECT name FROM games WHERE id = $1',
        [gameId]
      );
      const gameName = gameResult.rows[0]?.name || 'Unknown Game';

      await logGameUpdate(
        gameId,
        gameName,
        staffName || 'System',
        staffId || 'system',
        { images_reordered: imageHashes.length }
      );
    } catch (changelogError) {
      console.error('Failed to log image reorder to changelog:', changelogError);
    }

    return NextResponse.json({
      success: true,
      message: `Reordered ${imageHashes.length} images`,
      gameId,
    });
  } catch (error) {
    console.error('Error reordering images:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to reorder images';

    return NextResponse.json(
      { error: errorMsg, success: false },
      { status: 500 }
    );
  }
}
