/**
 * Backfill Missing Images Script
 *
 * Finds games without images and searches alternative APIs to fill them.
 * Uses image-fallback-service.ts to search RAWG, IGDB, and Google.
 */

const { Pool } = require('pg');
const axios = require('axios');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const RAWG_API_KEY = 'd09ed4b5586e41f697e1ad11e9690aad'; // Free public key

async function searchRAWG(gameName) {
  try {
    const searchUrl = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(gameName)}&platforms=7&page_size=1`;

    const response = await axios.get(searchUrl, { timeout: 10000 });
    const games = response.data.results;

    if (!games || games.length === 0) {
      return null;
    }

    const game = games[0];

    // Get screenshots
    const screenshotsUrl = `https://api.rawg.io/api/games/${game.id}/screenshots?key=${RAWG_API_KEY}`;
    const screenshotsResponse = await axios.get(screenshotsUrl, { timeout: 10000 });
    const screenshots = screenshotsResponse.data.results || [];

    return {
      landscape: game.background_image,
      portrait: game.background_image, // RAWG doesn't have separate portrait
      screenshot: screenshots[0]?.image || game.background_image,
      source: 'RAWG'
    };
  } catch (error) {
    console.error(`  ✗ RAWG search failed:`, error.message);
    return null;
  }
}

async function backfillMissingImages() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get games missing images
    const missingResult = await client.query(`
      SELECT id, name, platform,
        image_landscape_url,
        image_portrait_url,
        image_screenshot_url
      FROM video_games
      WHERE platform = 'switch'
        AND (image_landscape_url IS NULL
          OR image_portrait_url IS NULL
          OR image_screenshot_url IS NULL)
      ORDER BY name
    `);

    const gamesWithoutImages = missingResult.rows;
    console.log(`Found ${gamesWithoutImages.length} games with missing images\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < gamesWithoutImages.length; i++) {
      const game = gamesWithoutImages[i];
      console.log(`[${i + 1}/${gamesWithoutImages.length}] ${game.name}`);

      // Search for images
      const images = await searchRAWG(game.name);

      if (images && (images.landscape || images.portrait || images.screenshot)) {
        // Update database
        await client.query(`
          UPDATE video_games
          SET
            image_landscape_url = COALESCE(image_landscape_url, $1),
            image_portrait_url = COALESCE(image_portrait_url, $2),
            image_screenshot_url = COALESCE(image_screenshot_url, $3),
            updated_at = NOW()
          WHERE id = $4 AND platform = $5
        `, [
          images.landscape,
          images.portrait,
          images.screenshot,
          game.id,
          game.platform
        ]);

        console.log(`  ✓ Updated images from ${images.source}`);
        console.log(`    Landscape: ${images.landscape ? '✓' : '✗'}`);
        console.log(`    Portrait: ${images.portrait ? '✓' : '✗'}`);
        console.log(`    Screenshot: ${images.screenshot ? '✓' : '✗'}`);
        successCount++;
      } else {
        console.log(`  ✗ No images found`);
        failCount++;
      }

      // Rate limiting: wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n===== Summary =====`);
    console.log(`Total processed: ${gamesWithoutImages.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to find images: ${failCount}`);

    // Get final statistics
    const finalStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(image_landscape_url) as has_landscape,
        COUNT(image_portrait_url) as has_portrait,
        COUNT(image_screenshot_url) as has_screenshot
      FROM video_games
      WHERE platform = 'switch'
    `);

    console.log(`\n===== Final Statistics =====`);
    console.log(`Total games: ${finalStats.rows[0].total}`);
    console.log(`Has landscape: ${finalStats.rows[0].has_landscape} (${Math.round(finalStats.rows[0].has_landscape / finalStats.rows[0].total * 100)}%)`);
    console.log(`Has portrait: ${finalStats.rows[0].has_portrait} (${Math.round(finalStats.rows[0].has_portrait / finalStats.rows[0].total * 100)}%)`);
    console.log(`Has screenshot: ${finalStats.rows[0].has_screenshot} (${Math.round(finalStats.rows[0].has_screenshot / finalStats.rows[0].total * 100)}%)`);

  } finally {
    client.release();
    await pool.end();
  }
}

backfillMissingImages().catch(console.error);
