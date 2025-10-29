/**
 * Admin API - Video Game Images Management
 * GET: Check volume status and image count
 * POST: Trigger manual image download
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const VOLUME_PATH = process.env.VOLUME_PATH || path.join(process.cwd(), 'data', 'video-game-images');

export async function GET(request: NextRequest) {
  try {
    // Check if directory exists
    let exists = false;
    let fileCount = 0;
    let dirSize = 0;
    let sampleFiles: string[] = [];

    try {
      await fs.access(VOLUME_PATH);
      exists = true;

      // Count files
      const files = await fs.readdir(VOLUME_PATH);
      fileCount = files.length;
      sampleFiles = files.filter(f => f.endsWith('.jpg')).slice(0, 5);

      // Calculate total size
      for (const file of files) {
        try {
          const stats = await fs.stat(path.join(VOLUME_PATH, file));
          dirSize += stats.size;
        } catch {}
      }
    } catch {
      exists = false;
    }

    return NextResponse.json({
      volumePath: VOLUME_PATH,
      exists,
      fileCount,
      sizeMB: Math.round(dirSize / 1024 / 1024),
      expectedFiles: 1390, // Approximate based on 511 games × ~2.7 images (deduplicated)
      percentComplete: Math.round((fileCount / 1390) * 100),
      status: fileCount >= 1000 ? 'ready' : fileCount > 0 ? 'downloading' : 'empty',
      sampleFiles
    });
  } catch (error) {
    console.error('[Admin Video Game Images] Error checking status:', error);
    return NextResponse.json(
      { error: 'Failed to check volume status', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'download') {
      // Trigger download script in background
      console.log('[Admin Video Game Images] Starting download...');

      // Run download script asynchronously
      execAsync('node scripts/download-all-video-game-images.js')
        .then(() => {
          console.log('[Admin Video Game Images] Download script completed');
          // Run retry script for any failures
          return execAsync('node scripts/retry-failed-nintendo-images.js');
        })
        .then(() => {
          console.log('[Admin Video Game Images] Retry script completed');
        })
        .catch((error) => {
          console.error('[Admin Video Game Images] Download error:', error);
        });

      return NextResponse.json({
        success: true,
        message: 'Download started in background. Check status endpoint for progress.',
        note: 'This will take 15-30 minutes for ~1500 images'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use action: "download"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Admin Video Game Images] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: String(error) },
      { status: 500 }
    );
  }
}
