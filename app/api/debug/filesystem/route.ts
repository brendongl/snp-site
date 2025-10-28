/**
 * Debug Endpoint: Inspect Container Filesystem
 *
 * Check what directories and files exist in the container
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const checks = [];

    // Check /app/data-seed
    try {
      const { stdout: dataSeedLs } = await execAsync('ls -la /app/data-seed 2>&1 || echo "Directory not found"');
      checks.push({
        path: '/app/data-seed',
        exists: !dataSeedLs.includes('Directory not found'),
        contents: dataSeedLs
      });
    } catch (e) {
      checks.push({
        path: '/app/data-seed',
        error: (e as Error).message
      });
    }

    // Check /app/data-seed/video-game-images
    try {
      const { stdout: videoGameSeedLs } = await execAsync('ls -la /app/data-seed/video-game-images 2>&1 || echo "Directory not found"');
      const { stdout: videoGameSeedCount } = await execAsync('find /app/data-seed/video-game-images -type f 2>&1 | wc -l || echo "0"');

      checks.push({
        path: '/app/data-seed/video-game-images',
        exists: !videoGameSeedLs.includes('Directory not found'),
        fileCount: parseInt(videoGameSeedCount.trim()),
        sample: videoGameSeedLs.split('\n').slice(0, 10).join('\n')
      });
    } catch (e) {
      checks.push({
        path: '/app/data-seed/video-game-images',
        error: (e as Error).message
      });
    }

    // Check /app/data
    try {
      const { stdout: dataLs } = await execAsync('ls -la /app/data 2>&1 || echo "Directory not found"');
      checks.push({
        path: '/app/data',
        exists: !dataLs.includes('Directory not found'),
        contents: dataLs
      });
    } catch (e) {
      checks.push({
        path: '/app/data',
        error: (e as Error).message
      });
    }

    // Check /app/data/video-game-images
    try {
      const { stdout: videoGameDataLs } = await execAsync('ls -la /app/data/video-game-images 2>&1 || echo "Directory not found"');
      const { stdout: videoGameDataCount } = await execAsync('find /app/data/video-game-images -type f 2>&1 | wc -l || echo "0"');

      checks.push({
        path: '/app/data/video-game-images',
        exists: !videoGameDataLs.includes('Directory not found'),
        fileCount: parseInt(videoGameDataCount.trim()),
        sample: videoGameDataLs.split('\n').slice(0, 10).join('\n')
      });
    } catch (e) {
      checks.push({
        path: '/app/data/video-game-images',
        error: (e as Error).message
      });
    }

    // Check environment variables
    const env = {
      RAILWAY_VOLUME_MOUNT_PATH: process.env.RAILWAY_VOLUME_MOUNT_PATH || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      PWD: process.cwd()
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: env,
      checks
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to inspect filesystem',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
