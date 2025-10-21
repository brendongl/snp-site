import { Pool } from 'pg';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const CSV_PATH = path.join(process.cwd(), 'BG List-Grid view.csv');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

function parseImageColumn(imagesText: string): Array<{ filename: string; url: string }> {
  const images: Array<{ filename: string; url: string }> = [];

  // Match pattern: filename (url), filename (url), ...
  const regex = /([^\(]+)\s*\((https:\/\/[^\)]+)\)/g;
  let match;

  while ((match = regex.exec(imagesText)) !== null) {
    const filename = match[1].trim();
    const url = match[2].trim();
    images.push({ filename, url });
  }

  return images;
}

async function updateUrlsFromCsv() {
  console.log('🚀 Starting URL update from CSV...\n');

  // Read CSV file
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvContent.split('\n');

  console.log(`📄 Read ${lines.length} lines from CSV`);

  // Skip header row (line 0)
  const dataLines = lines.slice(1).filter(line => line.trim());

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    let totalImages = 0;
    let updatedImages = 0;
    let errors = 0;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];

      // Parse CSV line - handle commas inside quotes
      const parts: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current); // Add last part

      if (parts.length < 3) continue;

      const gameName = parts[0].trim();
      const bggId = parts[1].trim();
      const imagesText = parts[2].trim().replace(/^"|"$/g, ''); // Remove surrounding quotes

      if (!imagesText) continue;

      // Parse images
      const images = parseImageColumn(imagesText);

      if (images.length === 0) continue;

      for (const img of images) {
        totalImages++;

        try {
          // Match by filename and update the URL
          const result = await pool.query(
            `UPDATE game_images
             SET url = $1
             WHERE file_name = $2`,
            [img.url, img.filename]
          );

          if (result.rowCount && result.rowCount > 0) {
            updatedImages++;

            if (updatedImages % 50 === 0) {
              console.log(`  Updated ${updatedImages}/${totalImages} images...`);
            }
          }
        } catch (error) {
          errors++;
          console.error(`  ❌ Error updating image ${img.filename}: ${error}`);
        }
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  Processed ${i + 1}/${dataLines.length} games...`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Update Summary:');
    console.log(`  Total images found: ${totalImages}`);
    console.log(`  ✅ Successfully updated: ${updatedImages}`);
    console.log(`  ⏭️  Not found in DB: ${totalImages - updatedImages - errors}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log('='.repeat(50));
    console.log('\nℹ️  Note: Only existing image hashes were updated.');
    console.log('   If you see many "Not found in DB", run a full sync first.');
  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateUrlsFromCsv().catch((error) => {
  console.error(error);
  process.exit(1);
});
