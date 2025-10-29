/**
 * Fix Duplicate Screenshot Images
 *
 * Identifies games where screenshot URL === landscape URL
 * and attempts to find proper screenshot images from Nintendo EU API
 */

const { Pool } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
const TIMEOUT = 30000;

/**
 * Search Nintendo EU API for screenshots
 */
async function searchNintendoEU(gameName) {
  try {
    const searchUrl = `https://searching.nintendo-europe.com/en/select?q=${encodeURIComponent(gameName)}&fq=type:GAME AND system_type:nintendoswitch*&wt=json&rows=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const game = data?.response?.docs?.[0];

    if (!game) return null;

    // Try multiple screenshot sources in priority order
    const screenshots = [];

    // 1. Dedicated screenshot URLs (best quality)
    if (game.screenshot_image_url_h2x1_s && game.screenshot_image_url_h2x1_s.length > 0) {
      screenshots.push(...game.screenshot_image_url_h2x1_s);
    }

    // 2. Gallery images (often contains screenshots)
    if (game.gallery_image_url && game.gallery_image_url.length > 0) {
      screenshots.push(...game.gallery_image_url);
    }

    // Return first available screenshot that's different from the game's main image
    return screenshots.length > 0 ? screenshots[0] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Search DekuDeals for screenshots
 */
async function searchDekuDeals(gameName) {
  try {
    const searchUrl = `https://www.dekudeals.com/search?q=${encodeURIComponent(gameName)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Look for screenshot images (not just cover art)
    const screenshotRegex = /https:\/\/assets\.dekudeals\.com\/screenshots\/[^\s"']+\.(jpg|jpeg|png|webp)/gi;
    const screenshots = html.match(screenshotRegex);

    if (screenshots && screenshots.length > 0) {
      return screenshots[0]; // Return first screenshot
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Search multiple sources for screenshot
 */
async function findScreenshot(gameName, currentLandscapeUrl) {
  // Try Nintendo EU first
  let screenshot = await searchNintendoEU(gameName);
  if (screenshot && screenshot !== currentLandscapeUrl) {
    return { url: screenshot, source: 'Nintendo EU' };
  }

  // Try DekuDeals as fallback
  screenshot = await searchDekuDeals(gameName);
  if (screenshot && screenshot !== currentLandscapeUrl) {
    return { url: screenshot, source: 'DekuDeals' };
  }

  return null;
}

async function fixDuplicateScreenshots() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔍 Finding games with duplicate landscape/screenshot images...\n');

    // Find games where screenshot and landscape URLs are the same
    const result = await pool.query(`
      SELECT id, name, image_landscape_url, image_screenshot_url
      FROM video_games
      WHERE platform = 'switch'
        AND image_landscape_url IS NOT NULL
        AND image_screenshot_url IS NOT NULL
        AND image_landscape_url = image_screenshot_url
      ORDER BY name
    `);

    const duplicates = result.rows;
    console.log(`Found ${duplicates.length} games with duplicate images\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    let fixed = 0;
    let nulled = 0;
    let failed = 0;

    for (const game of duplicates) {
      console.log(`Processing: ${game.name}`);

      // Search for better screenshot from multiple sources
      const result = await findScreenshot(game.name, game.image_landscape_url);

      if (result) {
        // Found a different screenshot!
        await pool.query(`
          UPDATE video_games
          SET image_screenshot_url = $1, updated_at = NOW()
          WHERE id = $2
        `, [result.url, game.id]);
        console.log(`  ✓ Found screenshot from ${result.source}`);
        fixed++;
      } else {
        // No screenshot available - set to NULL instead of duplicate
        await pool.query(`
          UPDATE video_games
          SET image_screenshot_url = NULL, updated_at = NOW()
          WHERE id = $1
        `, [game.id]);
        console.log(`  ○ No screenshot found - set to NULL`);
        nulled++;
      }

      // Rate limit to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    console.log('\n📊 Summary:');
    console.log(`   Fixed with new screenshots: ${fixed}`);
    console.log(`   Set to NULL (no screenshot): ${nulled}`);
    console.log(`   Unchanged (no alternative):  ${failed}`);
    console.log(`   Total processed:             ${duplicates.length}`);

  } finally {
    await pool.end();
  }
}

fixDuplicateScreenshots().catch(console.error);
