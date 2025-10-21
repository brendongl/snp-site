import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// Ensure image cache directory exists
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
}

/**
 * POST /api/games/[id]/images
 * Upload new images for a game
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const { id: gameId } = await params;
    const formData = await request.formData();
    const images = formData.getAll('images') as File[];

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    const uploadedHashes: string[] = [];

    for (const image of images) {
      // Read file buffer
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generate hash
      const hash = crypto.createHash('md5').update(buffer).digest('hex');

      // Determine file extension
      const extension = path.extname(image.name) || '.jpg';
      const fileName = image.name;
      const filePath = path.join(IMAGE_CACHE_DIR, `${hash}${extension}`);

      // Save to disk
      fs.writeFileSync(filePath, buffer);

      // Insert into database
      await pool.query(
        `
        INSERT INTO game_images (game_id, hash, file_name, url)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (game_id, hash) DO NOTHING
        `,
        [gameId, hash, fileName, `/api/images/${hash}`]
      );

      uploadedHashes.push(hash);
    }

    await pool.end();

    return NextResponse.json({
      success: true,
      uploadedCount: uploadedHashes.length,
      hashes: uploadedHashes,
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    await pool.end();
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    );
  }
}
