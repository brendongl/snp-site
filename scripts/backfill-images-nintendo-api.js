/**
 * Backfill Missing Images Script - Nintendo EU API + DekuDeals
 *
 * Uses Nintendo Europe Search API (no auth required) and DekuDeals scraping
 * to find images for games missing from titledb.
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

/**
 * Search Nintendo Europe API by game name
 * Free, no authentication, official Nintendo API
 */
async function searchNintendoEU(gameName) {
  try {
    // Nintendo Europe uses Apache Solr search
    const searchUrl = `https://searching.nintendo-europe.com/en/select?q=${encodeURIComponent(gameName)}&fq=type:GAME AND system_type:nintendoswitch*&wt=json&rows=1`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.response && data.response.docs && data.response.docs.length > 0) {
      const game = data.response.docs[0];

      // Nintendo EU provides multiple image fields
      return {
        landscape: game.image_url_h2x1_s || game.image_url || null,
        portrait: game.image_url_sq_s || game.gift_finder_carousel_image_url_s || game.image_url || null,
        screenshot: game.screenshot_image_url_h2x1_s?.[0] || game.hero_banner_url || game.image_url_h2x1_s || null,
        source: 'Nintendo EU API'
      };
    }

    return null;
  } catch (error) {
    console.error(`  ✗ Nintendo EU search failed:`, error.message);
    return null;
  }
}

/**
 * Scrape DekuDeals for game images
 * Fallback if Nintendo EU doesn't have the game
 */
async function searchDekuDeals(gameName, titleId) {
  try {
    // First try with titleId if available
    let url = titleId
      ? `https://www.dekudeals.com/items/${titleId}`
      : `https://www.dekudeals.com/search?q=${encodeURIComponent(gameName)}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Extract OpenGraph image (best quality)
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);

    // Extract DekuDeals hosted images
    const dekuImages = html.match(/https:\/\/assets\.dekudeals\.com\/images\/[^\s"']+\.(jpg|jpeg|png|webp)/gi);

    if (ogImage || dekuImages) {
      const imageUrl = ogImage ? ogImage[1] : dekuImages[0];

      return {
        landscape: imageUrl,
        portrait: imageUrl, // Use same image for portrait
        screenshot: dekuImages && dekuImages[1] ? dekuImages[1] : imageUrl,
        source: 'DekuDeals'
      };
    }

    return null;
  } catch (error) {
    console.error(`  ✗ DekuDeals search failed:`, error.message);
    return null;
  }
}

/**
 * Try both sources in order
 */
async function findImages(gameName, titleId) {
  // Try Nintendo EU first (faster, more reliable)
  let images = await searchNintendoEU(gameName);
  if (images && images.landscape) {
    return images;
  }

  // Fallback to DekuDeals
  images = await searchDekuDeals(gameName, titleId);
  if (images && images.landscape) {
    return images;
  }

  return null;
}

async function backfillMissingImages() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Starting image backfill with Nintendo EU API + DekuDeals...\n');

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
    const results = [];

    for (let i = 0; i < gamesWithoutImages.length; i++) {
      const game = gamesWithoutImages[i];
      console.log(`[${i + 1}/${gamesWithoutImages.length}] ${game.name}`);

      // Search for images (use id as titleId for DekuDeals fallback)
      const images = await findImages(game.name, game.id);

      if (images && images.landscape) {
        // Update database - only fill in missing fields
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

        results.push({
          game: game.name,
          source: images.source,
          success: true
        });
      } else {
        console.log(`  ✗ No images found`);
        failCount++;

        results.push({
          game: game.name,
          source: 'none',
          success: false
        });
      }

      // Rate limiting: wait 500ms between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n===== Summary =====`);
    console.log(`Total processed: ${gamesWithoutImages.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Failed to find images: ${failCount}`);

    // Show breakdown by source
    const sources = {};
    results.filter(r => r.success).forEach(r => {
      sources[r.source] = (sources[r.source] || 0) + 1;
    });

    console.log(`\n===== Sources Used =====`);
    Object.entries(sources).forEach(([source, count]) => {
      console.log(`${source}: ${count} games`);
    });

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
    const stats = finalStats.rows[0];
    console.log(`Total games: ${stats.total}`);
    console.log(`Has landscape: ${stats.has_landscape} (${Math.round(stats.has_landscape / stats.total * 100)}%)`);
    console.log(`Has portrait: ${stats.has_portrait} (${Math.round(stats.has_portrait / stats.total * 100)}%)`);
    console.log(`Has screenshot: ${stats.has_screenshot} (${Math.round(stats.has_screenshot / stats.total * 100)}%)`);

    // Show games that still need images
    const stillMissing = await client.query(`
      SELECT name
      FROM video_games
      WHERE platform = 'switch'
        AND (image_landscape_url IS NULL
          OR image_portrait_url IS NULL
          OR image_screenshot_url IS NULL)
      ORDER BY name
      LIMIT 10
    `);

    if (stillMissing.rows.length > 0) {
      console.log(`\n===== Still Missing Images (first 10) =====`);
      stillMissing.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.name}`);
      });
    }

  } finally {
    client.release();
    await pool.end();
  }
}

backfillMissingImages().catch(console.error);
