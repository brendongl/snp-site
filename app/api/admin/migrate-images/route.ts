import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

interface ImageRecord {
  hash: string;
  url: string;
  file_name: string | null;
  game_id: string;
}

function getExtensionFromContentType(contentType: string, fileName: string | null): string {
  // Try to get extension from content type
  const typeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };

  if (typeMap[contentType]) {
    return typeMap[contentType];
  }

  // Fallback to file name extension if available
  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext) return ext;
  }

  // Default fallback
  return '.jpg';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    // Check for admin token in query params (basic security)
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (token !== 'migrate-images-2025') {
      return NextResponse.json(
        { error: 'Unauthorized - include ?token=migrate-images-2025' },
        { status: 401 }
      );
    }

    logs.push('🚀 Starting image migration...');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: 'DATABASE_URL not configured' },
        { status: 500 }
      );
    }

    // Create database connection
    const pool = new Pool({ connectionString: databaseUrl });

    // Ensure cache directory exists
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
      logs.push(`📁 Created directory: ${IMAGE_CACHE_DIR}`);
    }

    // Query all images from database
    const result = await pool.query<ImageRecord>(`
      SELECT hash, url, file_name, game_id
      FROM game_images
      ORDER BY game_id, hash
    `);

    const images = result.rows;
    logs.push(`📊 Found ${images.length} images to process`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each image
    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      // Check if image already exists
      const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      let existingPath = extensions.find((ext) =>
        fs.existsSync(path.join(IMAGE_CACHE_DIR, `${img.hash}${ext}`))
      );

      if (existingPath) {
        skipCount++;
        if (skipCount <= 5) {
          logs.push(`⏭️  [${i + 1}/${images.length}] Already cached: ${img.hash}`);
        }
        continue;
      }

      // Download image
      try {
        const response = await fetch(img.url, {
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine file extension
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const extension = getExtensionFromContentType(contentType, img.file_name);

        // Save to disk
        const filePath = path.join(IMAGE_CACHE_DIR, `${img.hash}${extension}`);
        fs.writeFileSync(filePath, buffer);

        successCount++;
        if (successCount <= 10) {
          logs.push(
            `✅ [${i + 1}/${images.length}] Downloaded: ${img.hash}${extension} (${(buffer.length / 1024).toFixed(1)}KB)`
          );
        } else if (successCount === 11) {
          logs.push(`... (showing first 10 successes, continuing silently) ...`);
        }

        // Rate limit protection - sleep every 10 images
        if (i % 10 === 0 && i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${img.hash}: ${errorMsg}`);

        if (errorCount <= 5) {
          logs.push(`❌ [${i + 1}/${images.length}] Error downloading ${img.hash}: ${errorMsg}`);
        }
      }
    }

    await pool.end();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    logs.push('');
    logs.push('='.repeat(50));
    logs.push('📊 Migration Summary:');
    logs.push(`✅ Successfully migrated: ${successCount}`);
    logs.push(`⏭️  Already cached: ${skipCount}`);
    logs.push(`❌ Errors: ${errorCount}`);
    logs.push(`⏱️  Duration: ${duration}s`);
    logs.push('='.repeat(50));

    if (errors.length > 0 && errors.length <= 10) {
      logs.push('');
      logs.push('Error details:');
      errors.forEach((err) => logs.push(`  - ${err}`));
    } else if (errors.length > 10) {
      logs.push('');
      logs.push(`(${errors.length} errors - showing first 10):`);
      errors.slice(0, 10).forEach((err) => logs.push(`  - ${err}`));
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: images.length,
        migrated: successCount,
        skipped: skipCount,
        errors: errorCount,
        duration: `${duration}s`,
      },
      logs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logs.push(`💥 Fatal error: ${errorMsg}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        logs,
      },
      { status: 500 }
    );
  }
}
