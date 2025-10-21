import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

/**
 * DELETE /api/games/[id]/images/[hash]
 * Delete an image from a game
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; hash: string }> }
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
    const { id: gameId, hash } = await params;

    // Delete from database
    const result = await pool.query(
      `
      DELETE FROM game_images
      WHERE game_id = $1 AND hash = $2
      RETURNING hash
      `,
      [gameId, hash]
    );

    if (result.rowCount === 0) {
      await pool.end();
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Check if this hash is used by any other games
    const otherGamesResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM game_images
      WHERE hash = $1
      `,
      [hash]
    );

    const otherGamesCount = parseInt(otherGamesResult.rows[0].count);

    // Only delete the file if no other games use this hash
    if (otherGamesCount === 0) {
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      for (const ext of extensions) {
        const filePath = path.join(IMAGE_CACHE_DIR, `${hash}${ext}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          break;
        }
      }
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
      hash,
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    await pool.end();
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
