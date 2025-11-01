/**
 * One-time migration script: Download all game images to Railway volume
 *
 * This script:
 * 1. Queries PostgreSQL for all game images
 * 2. Downloads each image from Airtable
 * 3. Saves to /app/data/images/[hash].[ext]
 *
 * Run on Railway: npx tsx scripts/migrate-images-to-volume.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

interface ImageRecord {
  hash: string;
  url: string;
  file_name: string;
  game_id: string;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  console.log(`  📥 Downloading from: ${url.substring(0, 80)}...`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  return { buffer, contentType };
}

function getExtensionFromContentType(contentType: string, fileName?: string): string {
  // Try to get extension from filename first
  if (fileName) {
    const ext = path.extname(fileName);
    if (ext) return ext;
  }

  // Fall back to content type
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('svg')) return '.svg';
  return '.jpg';
}

async function migrateImages() {
  console.log('🚀 Starting image migration to Railway volume...\n');

  // Get database connection
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Ensure cache directory exists
    console.log(`📁 Ensuring cache directory exists: ${IMAGE_CACHE_DIR}`);
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
      console.log('✅ Created cache directory\n');
    } else {
      console.log('✅ Cache directory exists\n');
    }

    // Query all images
    console.log('🔍 Querying database for all images...');
    const result = await pool.query<ImageRecord>(`
      SELECT hash, url, file_name, game_id
      FROM game_images
      ORDER BY game_id, hash
    `);

    const images = result.rows;
    console.log(`📊 Found ${images.length} images to migrate\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Download each image
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const progress = `[${i + 1}/${images.length}]`;

      console.log(`${progress} Processing hash: ${img.hash}`);

      try {
        // Check if already cached
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        let existingPath: string | null = null;

        for (const ext of extensions) {
          const potentialPath = path.join(IMAGE_CACHE_DIR, `${img.hash}${ext}`);
          if (fs.existsSync(potentialPath)) {
            existingPath = potentialPath;
            break;
          }
        }

        if (existingPath) {
          console.log(`  ⏭️  Already cached: ${path.basename(existingPath)}`);
          skipCount++;
          continue;
        }

        // Download image
        const { buffer, contentType } = await downloadImage(img.url);
        const extension = getExtensionFromContentType(contentType, img.file_name);

        // Save to disk
        const filePath = path.join(IMAGE_CACHE_DIR, `${img.hash}${extension}`);
        fs.writeFileSync(filePath, buffer);

        console.log(`  ✅ Saved: ${img.hash}${extension} (${Math.round(buffer.length / 1024)}KB)`);
        successCount++;

        // Add small delay to avoid rate limiting
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        errorCount++;
      }

      console.log(''); // Blank line between images
    }

    // Summary
    console.log('=' .repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ⏭️  Already cached: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total images: ${images.length}`);
    console.log('=' .repeat(60));

    if (errorCount > 0) {
      console.log('\n⚠️  Some images failed to migrate. You may want to retry.');
      process.exit(1);
    } else {
      console.log('\n🎉 Migration complete! All images are now stored on Railway volume.');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
migrateImages();
