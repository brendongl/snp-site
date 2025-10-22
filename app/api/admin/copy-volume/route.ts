/**
 * API Endpoint: Copy Volume Files from Staging to Production
 *
 * Fetches files from staging volume and writes them to production volume.
 *
 * Usage:
 *   POST /api/admin/copy-volume?action=sync&staging_url=https://...
 *
 * Environment Variables:
 *   STAGING_URL - Base URL of staging environment (optional, can be passed as param)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const stagingUrl = searchParams.get('staging_url') || process.env.STAGING_URL;

  if (!stagingUrl) {
    return NextResponse.json({
      error: 'Missing staging URL',
      hint: 'Provide ?staging_url=https://your-staging-url.railway.app or set STAGING_URL env variable'
    }, { status: 400 });
  }

  try {
    if (action === 'sync') {
      // Step 1: Get list of files from staging
      console.log('📋 Fetching file list from staging...');
      const listUrl = `${stagingUrl}/api/admin/staging-files?action=list`;
      const listResponse = await fetch(listUrl);

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch file list: ${listResponse.status} ${listResponse.statusText}`);
      }

      const { files, total } = await listResponse.json();
      console.log(`✅ Found ${total} files in staging`);

      const results = {
        total,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[]
      };

      // Step 2: Download and save each file
      for (const file of files) {
        try {
          // Skip log files (they're environment-specific)
          if (file.startsWith('logs/')) {
            console.log(`⊘ Skipping log file: ${file}`);
            results.skipped++;
            continue;
          }

          console.log(`📥 Copying: ${file}`);

          // Download file from staging
          const fileUrl = `${stagingUrl}/api/admin/staging-files?action=get&file=${encodeURIComponent(file)}`;
          const fileResponse = await fetch(fileUrl);

          if (!fileResponse.ok) {
            throw new Error(`Failed to download: ${fileResponse.status}`);
          }

          const fileContent = await fileResponse.arrayBuffer();
          const buffer = Buffer.from(fileContent);

          // Create directory if needed
          const fullPath = path.join(DATA_DIR, file);
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });

          // Write file
          await fs.writeFile(fullPath, buffer);
          console.log(`✅ Saved: ${file} (${buffer.length} bytes)`);

          results.success++;

        } catch (error) {
          const errorMsg = `${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`❌ Failed to copy ${file}:`, error);
          results.failed++;
          results.errors.push(errorMsg);
        }
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Volume Copy Summary:');
      console.log(`   ✅ Success: ${results.success}`);
      console.log(`   ⊘ Skipped: ${results.skipped}`);
      console.log(`   ❌ Failed: ${results.failed}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return NextResponse.json({
        success: true,
        message: 'Volume copy completed',
        results
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error copying volume:', error);
    return NextResponse.json({
      error: 'Failed to copy volume',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/copy-volume',
    usage: 'POST /api/admin/copy-volume?action=sync&staging_url=https://your-staging-url.railway.app',
    description: 'Copy all volume files from staging to production',
    note: 'This endpoint must be called on the production environment'
  });
}
