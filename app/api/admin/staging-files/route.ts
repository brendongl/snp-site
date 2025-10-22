/**
 * API Endpoint: Export Volume Files from Staging
 *
 * Serves files from the staging volume so they can be copied to production.
 *
 * Usage:
 *   GET /api/admin/staging-files?action=list        - List all files in volume
 *   GET /api/admin/staging-files?action=get&file=... - Download specific file
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const filePath = searchParams.get('file');

  try {
    // Action: List all files
    if (action === 'list') {
      const files = await getAllFiles(DATA_DIR);
      return NextResponse.json({
        success: true,
        files,
        total: files.length
      });
    }

    // Action: Get specific file content
    if (action === 'get' && filePath) {
      const fullPath = path.join(DATA_DIR, filePath);

      // Security: ensure file is within data directory
      if (!fullPath.startsWith(DATA_DIR)) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
      }

      const exists = await fs.access(fullPath).then(() => true).catch(() => false);
      if (!exists) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      const content = await fs.readFile(fullPath);

      return new NextResponse(content, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Path': filePath,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error serving staging files:', error);
    return NextResponse.json({
      error: 'Failed to serve files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Recursively get all files in directory
async function getAllFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else {
        // Get relative path from base directory
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        files.push(relativePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}
