/**
 * Download All Video Game Images to Persistent Volume
 *
 * Downloads all images from Nintendo CDN and saves them to /app/data/video-game-images/
 * Updates database to use local paths instead of external URLs
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const VOLUME_PATH = process.env.VOLUME_PATH || './data/video-game-images';
const MAX_CONCURRENT = 5; // Download 5 images at a time
const RETRY_COUNT = 3;
const TIMEOUT = 30000;

/**
 * Ensure directory exists
 */
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Download image with retries
 */
async function downloadImage(url, retries = RETRY_COUNT) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type');

      // Verify it's actually an image
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Not an image: ${contentType}`);
      }

      // Verify minimum size (1KB)
      if (buffer.byteLength < 1024) {
        throw new Error(`Image too small: ${buffer.byteLength} bytes`);
      }

      return Buffer.from(buffer);
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Generate hash for image
 */
function generateHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Save image to volume
 */
async function saveImage(buffer, hash) {
  const filename = `${hash}.jpg`;
  const filepath = path.join(VOLUME_PATH, filename);

  await fs.writeFile(filepath, buffer);
  return filename;
}

/**
 * Process a single game's images
 */
async function processGameImages(game) {
  const results = {
    game: game.name,
    landscape: null,
    portrait: null,
    screenshot: null,
    errors: []
  };

  const imageTypes = [
    { key: 'landscape', url: game.image_landscape_url },
    { key: 'portrait', url: game.image_portrait_url },
    { key: 'screenshot', url: game.image_screenshot_url }
  ];

  for (const { key, url } of imageTypes) {
    if (!url) continue;

    try {
      // Download image
      const buffer = await downloadImage(url);

      // Generate hash
      const hash = generateHash(buffer);

      // Save to volume
      const filename = await saveImage(buffer, hash);

      // Store local path
      results[key] = `/api/video-games/images/${filename}`;

    } catch (error) {
      results.errors.push(`${key}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Update database with local image paths
 */
async function updateDatabase(client, gameId, localPaths) {
  await client.query(`
    UPDATE video_games
    SET
      image_landscape_url = $1,
      image_portrait_url = $2,
      image_screenshot_url = $3,
      updated_at = NOW()
    WHERE id = $4 AND platform = 'switch'
  `, [
    localPaths.landscape,
    localPaths.portrait,
    localPaths.screenshot,
    gameId
  ]);
}

/**
 * Process batch of games concurrently
 */
async function processBatch(games, batchNum, totalBatches) {
  const results = await Promise.all(
    games.map(game => processGameImages(game))
  );

  return results;
}

/**
 * Main function
 */
async function downloadAllImages() {
  console.log('🎮 Downloading All Video Game Images\n');
  console.log(`Volume path: ${VOLUME_PATH}`);
  console.log(`Database: ${DATABASE_URL.split('@')[1] || 'local'}\n`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Ensure volume directory exists
    await ensureDir(VOLUME_PATH);
    console.log('✓ Volume directory ready\n');

    // Get all games with external image URLs
    const result = await client.query(`
      SELECT id, name,
        image_landscape_url,
        image_portrait_url,
        image_screenshot_url
      FROM video_games
      WHERE platform = 'switch'
        AND (image_landscape_url LIKE 'https://%'
          OR image_portrait_url LIKE 'https://%'
          OR image_screenshot_url LIKE 'https://%')
      ORDER BY name
    `);

    const games = result.rows;
    console.log(`Found ${games.length} games with external image URLs\n`);

    if (games.length === 0) {
      console.log('✓ All images already cached locally!');
      return;
    }

    // Process in batches
    const batchSize = MAX_CONCURRENT;
    const totalBatches = Math.ceil(games.length / batchSize);

    let successCount = 0;
    let failCount = 0;
    let downloadedCount = 0;

    console.log('Starting download...\n');

    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} games...`);

      const results = await processBatch(batch, batchNum, totalBatches);

      // Update database for successful downloads
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const game = batch[j];

        if (result.errors.length === 0) {
          await updateDatabase(client, game.id, result);
          successCount++;
          downloadedCount += 3; // 3 images per game
          console.log(`  ✓ ${result.game} (3 images)`);
        } else {
          failCount++;
          console.log(`  ✗ ${result.game}`);
          result.errors.forEach(err => console.log(`    - ${err}`));
        }
      }

      console.log('');

      // Rate limiting - wait 500ms between batches
      if (i + batchSize < games.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final statistics
    const finalStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_landscape_url LIKE '/api/%' THEN 1 END) as local_landscape,
        COUNT(CASE WHEN image_portrait_url LIKE '/api/%' THEN 1 END) as local_portrait,
        COUNT(CASE WHEN image_screenshot_url LIKE '/api/%' THEN 1 END) as local_screenshot
      FROM video_games
      WHERE platform = 'switch'
    `);

    const stats = finalStats.rows[0];

    console.log('═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total games processed: ${games.length}`);
    console.log(`Successfully cached: ${successCount} games (${downloadedCount} images)`);
    console.log(`Failed: ${failCount} games`);
    console.log('');
    console.log('Database Status:');
    console.log(`  Local landscape: ${stats.local_landscape}/${stats.total} (${Math.round(stats.local_landscape / stats.total * 100)}%)`);
    console.log(`  Local portrait: ${stats.local_portrait}/${stats.total} (${Math.round(stats.local_portrait / stats.total * 100)}%)`);
    console.log(`  Local screenshot: ${stats.local_screenshot}/${stats.total} (${Math.round(stats.local_screenshot / stats.total * 100)}%)`);
    console.log('═'.repeat(60));

    if (failCount > 0) {
      console.log('\n⚠️  Some images failed to download. Run this script again to retry.');
    } else {
      console.log('\n🎉 All images successfully cached to volume!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

downloadAllImages().catch(console.error);
