import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

function getExtensionFromContentType(contentType: string, fileName: string | null): string {
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

  if (fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (ext) return ext;
  }

  return '.jpg';
}

async function downloadImages() {
  console.log('🚀 Starting image download from database...\n');

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Ensure cache directory exists
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
      console.log(`📁 Created directory: ${IMAGE_CACHE_DIR}\n`);
    }

    // Query all images from database
    const result = await pool.query<{
      hash: string;
      url: string;
      file_name: string | null;
      game_id: string;
    }>(`
      SELECT hash, url, file_name, game_id
      FROM game_images
      ORDER BY game_id, hash
    `);

    const images = result.rows;
    console.log(`📊 Found ${images.length} images in database\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

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
          console.log(`⏭️  [${i + 1}/${images.length}] Already cached: ${img.hash}`);
        } else if (skipCount === 6) {
          console.log(`   ... (showing first 5 skips) ...`);
        }
        continue;
      }

      // Download image
      try {
        const response = await fetch(img.url, {
          signal: AbortSignal.timeout(30000),
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
          console.log(
            `✅ [${i + 1}/${images.length}] Downloaded: ${img.hash}${extension} (${(buffer.length / 1024).toFixed(1)}KB)`
          );
        } else if (successCount === 11) {
          console.log(`   ... (showing first 10 successes) ...`);
        }

        // Progress updates
        if (successCount % 50 === 0) {
          console.log(`   Progress: ${successCount} downloaded, ${skipCount} skipped, ${errorCount} errors`);
        }

        // Rate limit protection
        if (i % 10 === 0 && i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${img.hash} (${img.file_name || 'no filename'}): ${errorMsg}`);

        if (errorCount <= 5) {
          console.log(`❌ [${i + 1}/${images.length}] Error: ${img.hash} - ${errorMsg}`);
        } else if (errorCount === 6) {
          console.log(`   ... (showing first 5 errors) ...`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Download Summary:');
    console.log(`  Total images in DB: ${images.length}`);
    console.log(`  ✅ Successfully downloaded: ${successCount}`);
    console.log(`  ⏭️  Already cached: ${skipCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));

    if (errors.length > 0 && errors.length <= 10) {
      console.log('\nError details:');
      errors.forEach((err) => console.log(`  - ${err}`));
    } else if (errors.length > 10) {
      console.log(`\n(${errors.length} errors - showing first 10):`);
      errors.slice(0, 10).forEach((err) => console.log(`  - ${err}`));
    }
  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

downloadImages().catch((error) => {
  console.error(error);
  process.exit(1);
});
