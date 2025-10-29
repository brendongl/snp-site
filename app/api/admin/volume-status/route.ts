import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/volume-status
 *
 * Check the status of images on Railway persistent volume
 */
export async function GET(request: NextRequest) {
  try {
    // Check both possible locations
    const boardGamePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'images')
      : path.join(process.cwd(), 'data', 'images');

    const videoGamePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
      ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'video-game-images')
      : path.join(process.cwd(), 'data', 'video-game-images');

    const result = {
      environment: {
        RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH || 'not set',
        RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME || 'not set',
        RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME || 'not set',
        isRailway: !!process.env.RAILWAY_ENVIRONMENT_NAME,
      },
      boardGames: {
        path: boardGamePath,
        exists: false,
        fileCount: 0,
        totalSizeMB: 0,
        sampleFiles: [] as string[],
      },
      videoGames: {
        path: videoGamePath,
        exists: false,
        fileCount: 0,
        totalSizeMB: 0,
        sampleFiles: [] as string[],
      },
    };

    // Check board game images
    if (fs.existsSync(boardGamePath)) {
      const files = fs.readdirSync(boardGamePath);
      result.boardGames.exists = true;
      result.boardGames.fileCount = files.length;

      // Calculate total size and get samples
      let totalSize = 0;
      files.forEach((file, index) => {
        const filePath = path.join(boardGamePath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        if (index < 5) {
          result.boardGames.sampleFiles.push(file);
        }
      });

      result.boardGames.totalSizeMB = Math.round((totalSize / 1024 / 1024) * 100) / 100;
    }

    // Check video game images
    if (fs.existsSync(videoGamePath)) {
      const files = fs.readdirSync(videoGamePath);
      result.videoGames.exists = true;
      result.videoGames.fileCount = files.length;

      // Calculate total size and get samples
      let totalSize = 0;
      files.forEach((file, index) => {
        const filePath = path.join(videoGamePath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        if (index < 5) {
          result.videoGames.sampleFiles.push(file);
        }
      });

      result.videoGames.totalSizeMB = Math.round((totalSize / 1024 / 1024) * 100) / 100;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error checking volume status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check volume status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}