/**
 * Download and Cache New Screenshots
 *
 * Downloads the 142 newly added screenshot URLs from Nintendo CDN
 * and caches them to the local volume with local paths.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATABASE_URL = process.env.DATABASE_URL;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'video-game-images', 'switch');

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 Download and Cache New Screenshots');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✅ Created directory: ${OUTPUT_DIR}`);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get games with external screenshot URLs (not cached locally yet)
    const { rows: games } = await client.query(`
      SELECT id, name, image_screenshot_url
      FROM video_games
      WHERE platform = 'switch'
        AND image_screenshot_url IS NOT NULL
        AND image_screenshot_url LIKE 'http%'
      ORDER BY name
    `);

    console.log(`📊 Found ${games.length} games with external screenshot URLs\n`);

    const stats = {
      total: games.length,
      downloaded: 0,
      skipped: 0,
      errors: 0
    };

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`[${i + 1}/${games.length}] ${game.name}`);

      const screenshotPath = path.join(OUTPUT_DIR, `${game.id}_screenshot.jpg`);

      // Check if already exists locally
      if (fs.existsSync(screenshotPath)) {
        console.log(`   ⏭️  Already cached locally`);
        stats.skipped++;
        continue;
      }

      try {
        // Download from Nintendo CDN
        console.log(`   📥 Downloading from: ${game.image_screenshot_url}`);
        await downloadImage(game.image_screenshot_url, screenshotPath);
        console.log(`   ✅ Downloaded and cached`);

        // Update database to use local cached path
        await client.query(
          `UPDATE video_games
           SET image_screenshot_url = $1, updated_at = NOW()
           WHERE id = $2`,
          [`/api/video-games/cached-images/${game.id}_screenshot.jpg`, game.id]
        );
        console.log(`   ✅ Updated database to use local path`);

        stats.downloaded++;
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        stats.errors++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total games:       ${stats.total}`);
    console.log(`   ✅ Downloaded:     ${stats.downloaded}`);
    console.log(`   ⏭️  Already cached: ${stats.skipped}`);
    console.log(`   ❌ Errors:         ${stats.errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
