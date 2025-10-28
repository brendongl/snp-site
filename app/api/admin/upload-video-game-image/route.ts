/**
 * API Endpoint: Upload Video Game Images to Persistent Volume
 *
 * Accepts image files via HTTP POST and saves them to the persistent volume.
 * This allows uploading images from local machine to Railway without CLI complexity.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = '/app/data/video-game-images';

export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;

    if (!file || !filename) {
      return NextResponse.json({
        error: 'Missing file or filename'
      }, { status: 400 });
    }

    // Ensure directory exists
    await fs.mkdir(IMAGES_DIR, { recursive: true });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write to persistent volume
    const targetPath = path.join(IMAGES_DIR, filename);
    await fs.writeFile(targetPath, buffer);

    // Verify file was written
    const stats = await fs.stat(targetPath);

    return NextResponse.json({
      success: true,
      filename,
      size: stats.size,
      path: targetPath
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return current status
    const files = await fs.readdir(IMAGES_DIR).catch(() => []);
    const count = files.filter(f => f.endsWith('.jpg')).length;

    return NextResponse.json({
      endpoint: '/api/admin/upload-video-game-image',
      usage: 'POST with FormData: file (File) and filename (string)',
      currentImages: count,
      targetImages: 2501,
      percentComplete: Math.round((count / 2501) * 100)
    });
  } catch (error) {
    return NextResponse.json({
      endpoint: '/api/admin/upload-video-game-image',
      usage: 'POST with FormData: file (File) and filename (string)',
      currentImages: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
