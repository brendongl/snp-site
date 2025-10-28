/**
 * Retry Failed Nintendo CDN Downloads
 *
 * Retry with different headers and user agents to bypass geo-restrictions
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const VOLUME_PATH = process.env.VOLUME_PATH || './data/video-game-images';
const MAX_CONCURRENT = 5;
const RETRY_COUNT = 3;
const TIMEOUT = 30000;

// Try different user agents and headers
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/606.4 (KHTML, like Gecko) NF/6.0.2.21.2 NintendoBrowser/5.1.0.22474'
];

/**
 * Download image with retries and different strategies
 */
async function downloadImage(url, retries = RETRY_COUNT) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    // Cycle through user agents
    const userAgent = USER_AGENTS[attempt % USER_AGENTS.length];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.nintendo.com/'
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type');

      // Be more lenient with content-type - accept octet-stream if it looks like an image
      const isImage = contentType && (
        contentType.startsWith('image/') ||
        contentType === 'application/octet-stream'
      );

      if (!isImage) {
        throw new Error(`Not an image: ${contentType}`);
      }

      // Verify minimum size (1KB)
      if (buffer.byteLength < 1024) {
        throw new Error(`Image too small: ${buffer.byteLength} bytes`);
      }

      // Verify it's actually an image by checking magic bytes
      const buf = Buffer.from(buffer);
      const isValidImage = (
        // JPEG
        (buf[0] === 0xFF && buf[1] === 0xD8) ||
        // PNG
        (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) ||
        // WebP
        (buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) ||
        // GIF
        (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
      );

      if (!isValidImage) {
        throw new Error('Invalid image magic bytes');
      }

      return buf;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry (exponential backoff)
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
    if (!url || !url.startsWith('https://')) continue;

    try {
      // Download image
      const buffer = await downloadImage(url);

      // Generate hash
      const hash = generateHash(buffer);

      // Save to volume
      const filename = await saveImage(buffer, hash);

      // Store local path
      results[key] = `/api/video-games/cached-images/${filename}`;

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
 * Main function
 */
async function retryFailedDownloads() {
  console.log('🎮 Retrying Failed Nintendo CDN Downloads\n');
  console.log(`Volume path: ${VOLUME_PATH}`);
  console.log(`Database: ${DATABASE_URL.split('@')[1] || 'local'}\n`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get games that still have external image URLs
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
    console.log(`Found ${games.length} games still needing images\n`);

    if (games.length === 0) {
      console.log('✓ All images already cached locally!');
      return;
    }

    // Process in batches
    const batchSize = MAX_CONCURRENT;
    const totalBatches = Math.ceil(games.length / batchSize);

    let successCount = 0;
    let partialCount = 0;
    let failCount = 0;
    let downloadedCount = 0;

    console.log('Retrying with improved headers...\n');

    for (let i = 0; i < games.length; i += batchSize) {
      const batch = games.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} games...`);

      const results = await Promise.all(
        batch.map(game => processGameImages(game))
      );

      // Update database for successful downloads
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const game = batch[j];

        const successfulImages = [result.landscape, result.portrait, result.screenshot].filter(Boolean).length;

        if (successfulImages > 0) {
          await updateDatabase(client, game.id, result);
          downloadedCount += successfulImages;

          if (successfulImages === 3) {
            successCount++;
            console.log(`  ✓ ${result.game} (3 images)`);
          } else {
            partialCount++;
            console.log(`  ⚠ ${result.game} (${successfulImages}/3 images)`);
            result.errors.forEach(err => console.log(`    - ${err}`));
          }
        } else {
          failCount++;
          console.log(`  ✗ ${result.game} - All downloads failed`);
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
    console.log(`Fully successful: ${successCount} games`);
    console.log(`Partially successful: ${partialCount} games`);
    console.log(`Failed: ${failCount} games`);
    console.log(`Total images downloaded: ${downloadedCount}`);
    console.log('');
    console.log('Database Status:');
    console.log(`  Local landscape: ${stats.local_landscape}/${stats.total} (${Math.round(stats.local_landscape / stats.total * 100)}%)`);
    console.log(`  Local portrait: ${stats.local_portrait}/${stats.total} (${Math.round(stats.local_portrait / stats.total * 100)}%)`);
    console.log(`  Local screenshot: ${stats.local_screenshot}/${stats.total} (${Math.round(stats.local_screenshot / stats.total * 100)}%)`);
    console.log('═'.repeat(60));

    if (failCount > 0) {
      console.log('\n⚠️  Some games still failed. Consider manual fallback or placeholder images.');
    } else if (partialCount > 0) {
      console.log('\n⚠️  Some games only have partial image coverage.');
    } else {
      console.log('\n🎉 All images successfully cached!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

retryFailedDownloads().catch(console.error);
