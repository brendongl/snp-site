import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logPhotoAdded } from '@/lib/services/changelog-service';
import { awardPoints } from '@/lib/services/points-service';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

/**
 * POST /api/games/[id]/images
 * Upload new images for a game
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    return NextResponse.json(
      { error: 'Database configuration missing' },
      { status: 500 }
    );
  }

  // Ensure image cache directory exists
  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { id: gameId } = await params;
    console.log(`[Image Upload] Starting upload for game: ${gameId}`);

    const formData = await request.formData();
    const images = formData.getAll('images') as File[];
    const staffId = formData.get('staffId') as string | null;
    const staffName = formData.get('staffName') as string | null;

    if (images.length === 0) {
      console.log('[Image Upload] No images provided in formData');
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    console.log(`[Image Upload] Received ${images.length} images`);
    const uploadedHashes: string[] = [];

    for (const image of images) {
      console.log(`[Image Upload] Processing image: ${image.name}, size: ${image.size} bytes`);

      // Read file buffer
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate hash
      const hash = crypto.createHash('md5').update(buffer).digest('hex');
      console.log(`[Image Upload] Generated hash: ${hash}`);

      // Determine file extension
      const extension = path.extname(image.name) || '.jpg';
      const fileName = image.name;
      const filePath = path.join(IMAGE_CACHE_DIR, `${hash}${extension}`);

      // Save to disk
      try {
        fs.writeFileSync(filePath, buffer);
        console.log(`[Image Upload] Saved to disk: ${filePath}`);
      } catch (fsError) {
        console.error(`[Image Upload] Filesystem error:`, fsError);
        throw new Error(`Failed to save image to disk: ${fsError instanceof Error ? fsError.message : 'Unknown error'}`);
      }

      // Insert into database
      try {
        await pool.query(
          `
          INSERT INTO game_images (game_id, hash, file_name, url)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (game_id, hash) DO NOTHING
          `,
          [gameId, hash, fileName, `/api/images/${hash}`]
        );
        console.log(`[Image Upload] Database record created for hash: ${hash}`);
      } catch (dbError) {
        console.error(`[Image Upload] Database error:`, dbError);
        throw new Error(`Failed to save image to database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }

      uploadedHashes.push(hash);
    }

    // Log to changelog
    try {
      const gameResult = await pool.query('SELECT name FROM games WHERE id = $1', [gameId]);
      const gameName = gameResult.rows.length > 0 ? gameResult.rows[0].name : 'Unknown Game';

      await logPhotoAdded(
        gameId,
        gameName,
        staffName || 'System',
        staffId || 'system',
        uploadedHashes.length
      );
    } catch (changelogError) {
      console.error('Failed to log photo addition to changelog:', changelogError);
    }

    // Award points for photo uploads (async, non-blocking)
    if (staffId && staffId !== 'system') {
      for (let i = 0; i < uploadedHashes.length; i++) {
        awardPoints({
          staffId: staffId,
          actionType: 'photo_upload',
          metadata: {
            gameId: gameId
          },
          context: `Photo upload for game ${gameId} (${i + 1}/${uploadedHashes.length})`
        }).catch(err => {
          console.error('Failed to award photo upload points:', err);
        });
      }
    }

    await pool.end();

    console.log(`[Image Upload] Successfully uploaded ${uploadedHashes.length} images`);
    return NextResponse.json({
      success: true,
      uploadedCount: uploadedHashes.length,
      hashes: uploadedHashes,
    });
  } catch (error) {
    console.error('[Image Upload] Upload failed:', error);
    await pool.end();
    return NextResponse.json(
      {
        error: 'Failed to upload images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
