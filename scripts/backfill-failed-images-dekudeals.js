/**
 * Backfill Failed Video Game Images using DekuDeals
 *
 * For the 56 games that failed with Nintendo CDN, scrape images from DekuDeals
 * which has comprehensive Nintendo Switch game coverage.
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const VOLUME_PATH = process.env.VOLUME_PATH || './data/video-game-images';
const MAX_CONCURRENT = 3; // Be respectful to DekuDeals
const RETRY_COUNT = 3;
const TIMEOUT = 30000;

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
 * Search DekuDeals for game
 */
async function searchDekuDeals(gameName) {
  try {
    // Normalize game name for URL
    const searchQuery = gameName
      .toLowerCase()
      .replace(/[™®©]/g, '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const searchUrl = `https://www.dekudeals.com/items/${searchQuery}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`DekuDeals returned ${response.status}`);
    }

    const html = await response.text();

    // Extract images from DekuDeals page
    // DekuDeals uses Nintendo CDN images, but also has screenshots
    const landscapeMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const screenshotMatches = html.match(/data-src="(https:\/\/assets\.nintendo\.com\/image\/upload[^"]+)"/g);

    const landscape = landscapeMatch ? landscapeMatch[1] : null;
    const portrait = landscape; // Use same image for portrait
    const screenshot = screenshotMatches && screenshotMatches.length > 0
      ? screenshotMatches[0].match(/data-src="([^"]+)"/)[1]
      : landscape;

    return {
      landscape,
      portrait,
      screenshot,
      source: 'DekuDeals'
    };
  } catch (error) {
    console.error(`  Failed to search DekuDeals: ${error.message}`);
    return null;
  }
}

/**
 * Generate placeholder image with game name
 */
async function generatePlaceholder(gameName) {
  // For now, just return null - we could implement canvas-based text rendering
  // but it requires additional dependencies
  return null;
}

/**
 * Process a single failed game
 */
async function processFailedGame(game) {
  const results = {
    game: game.name,
    landscape: null,
    portrait: null,
    screenshot: null,
    errors: []
  };

  try {
    // Try DekuDeals first
    console.log(`  Searching DekuDeals for "${game.name}"...`);
    const dekuImages = await searchDekuDeals(game.name);

    if (dekuImages && (dekuImages.landscape || dekuImages.portrait || dekuImages.screenshot)) {
      const imageTypes = [
        { key: 'landscape', url: dekuImages.landscape },
        { key: 'portrait', url: dekuImages.portrait },
        { key: 'screenshot', url: dekuImages.screenshot }
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
          results[key] = `/api/video-games/cached-images/${filename}`;

        } catch (error) {
          results.errors.push(`${key}: ${error.message}`);
        }
      }
    } else {
      results.errors.push('No images found on DekuDeals');
    }

  } catch (error) {
    results.errors.push(`Search failed: ${error.message}`);
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
async function backfillFailedImages() {
  console.log('🎮 Backfilling Failed Video Game Images from DekuDeals\n');
  console.log(`Volume path: ${VOLUME_PATH}`);
  console.log(`Database: ${DATABASE_URL.split('@')[1] || 'local'}\n`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get games that still have external image URLs (failed downloads)
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

    const failedGames = result.rows;
    console.log(`Found ${failedGames.length} games still needing images\n`);

    if (failedGames.length === 0) {
      console.log('✓ All images already cached locally!');
      return;
    }

    // Process in batches
    const batchSize = MAX_CONCURRENT;
    const totalBatches = Math.ceil(failedGames.length / batchSize);

    let successCount = 0;
    let failCount = 0;
    let downloadedCount = 0;

    console.log('Starting backfill with DekuDeals fallback...\n');

    for (let i = 0; i < failedGames.length; i += batchSize) {
      const batch = failedGames.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} games...`);

      const results = await Promise.all(
        batch.map(game => processFailedGame(game))
      );

      // Update database for successful downloads
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const game = batch[j];

        if (result.errors.length === 0) {
          await updateDatabase(client, game.id, result);
          successCount++;
          downloadedCount += 3; // 3 images per game
          console.log(`  ✓ ${result.game} (3 images from DekuDeals)`);
        } else {
          failCount++;
          console.log(`  ✗ ${result.game}`);
          result.errors.forEach(err => console.log(`    - ${err}`));
        }
      }

      console.log('');

      // Rate limiting - wait 2 seconds between batches (be respectful)
      if (i + batchSize < failedGames.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    console.log(`Total games processed: ${failedGames.length}`);
    console.log(`Successfully cached: ${successCount} games (${downloadedCount} images)`);
    console.log(`Failed: ${failCount} games`);
    console.log('');
    console.log('Database Status:');
    console.log(`  Local landscape: ${stats.local_landscape}/${stats.total} (${Math.round(stats.local_landscape / stats.total * 100)}%)`);
    console.log(`  Local portrait: ${stats.local_portrait}/${stats.total} (${Math.round(stats.local_portrait / stats.total * 100)}%)`);
    console.log(`  Local screenshot: ${stats.local_screenshot}/${stats.total} (${Math.round(stats.local_screenshot / stats.total * 100)}%)`);
    console.log('═'.repeat(60));

    if (failCount > 0) {
      console.log('\n⚠️  Some images still failed. Manual fallback may be needed.');
    } else {
      console.log('\n🎉 All failed images successfully backfilled from DekuDeals!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

backfillFailedImages().catch(console.error);