/**
 * API Endpoint: Seed Video Game Images from Container to Volume
 *
 * Copies video game images from /app/data-seed to /app/data on the persistent volume
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const seedPath = '/app/data-seed/video-game-images';
    const targetPath = '/app/data/video-game-images';

    // Check if seed exists
    try {
      await fs.access(seedPath);
    } catch {
      return NextResponse.json({
        error: 'Seed directory not found',
        seedPath
      }, { status: 404 });
    }

    // Count files in seed
    const { stdout: seedCount } = await execAsync(`find ${seedPath} -type f | wc -l`);
    const seedFileCount = parseInt(seedCount.trim());

    // Count existing files on volume
    let targetFileCount = 0;
    try {
      const { stdout: targetCount } = await execAsync(`find ${targetPath} -type f 2>/dev/null | wc -l`);
      targetFileCount = parseInt(targetCount.trim());
    } catch {
      // Directory might not exist
    }

    console.log(`📊 Seed has ${seedFileCount} files`);
    console.log(`📊 Target has ${targetFileCount} files`);

    if (targetFileCount >= seedFileCount) {
      return NextResponse.json({
        message: 'Images already seeded',
        seedFileCount,
        targetFileCount,
        skipped: true
      });
    }

    // Remove existing directory
    console.log(`🗑️  Removing existing directory: ${targetPath}`);
    await execAsync(`rm -rf ${targetPath}`);

    // Copy from seed
    console.log(`📥 Copying from ${seedPath} to ${targetPath}`);
    const startTime = Date.now();

    await execAsync(`cp -r ${seedPath} /app/data/`);

    const duration = Date.now() - startTime;

    // Verify copy
    const { stdout: newCount } = await execAsync(`find ${targetPath} -type f | wc -l`);
    const newFileCount = parseInt(newCount.trim());

    console.log(`✅ Copy completed: ${newFileCount} files in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Video game images seeded successfully',
      seedFileCount,
      copiedFileCount: newFileCount,
      durationMs: duration
    });

  } catch (error) {
    console.error('Error seeding video game images:', error);
    return NextResponse.json({
      error: 'Failed to seed video game images',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const seedPath = '/app/data-seed/video-game-images';
    const targetPath = '/app/data/video-game-images';

    const { stdout: seedCount } = await execAsync(`find ${seedPath} -type f 2>/dev/null | wc -l || echo "0"`);
    const { stdout: targetCount } = await execAsync(`find ${targetPath} -type f 2>/dev/null | wc -l || echo "0"`);

    return NextResponse.json({
      endpoint: '/api/admin/seed-video-game-images',
      usage: 'POST to this endpoint to copy images from container to volume',
      status: {
        seedFileCount: parseInt(seedCount.trim()),
        targetFileCount: parseInt(targetCount.trim()),
        needsSeeding: parseInt(targetCount.trim()) < parseInt(seedCount.trim())
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
