/**
 * Find and Download Missing Video Game Screenshots
 *
 * This script systematically finds and downloads screenshots for all games
 * that don't currently have screenshot images.
 *
 * Sources (in order of preference):
 * 1. Nintendo CDN (official)
 * 2. DekuDeals API (aggregated official sources)
 * 3. Google Custom Search API (unofficial - tracked separately)
 *
 * Usage: node scripts/find-and-download-missing-screenshots.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DATABASE_URL = process.env.DATABASE_URL;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'video-game-images', 'switch');
const UNOFFICIAL_SOURCES_LOG = path.join(__dirname, '..', 'unofficial-screenshot-sources.json');

// Track unofficial sources
const unofficialSources = [];

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
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

async function tryNintendoCDN(gameId, gameName) {
  // Try various Nintendo CDN URL patterns
  const patterns = [
    `https://assets.nintendo.com/image/upload/c_fill,w_1200/q_auto:best/f_auto/dpr_2.0/ncom/en_US/games/switch/${gameId}/${gameId}-screenshot`,
    `https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_2.0/c_limit,w_1200/ncom/en_US/games/switch/${gameId}/screenshot-gallery/screenshot01`
  ];

  for (const pattern of patterns) {
    try {
      const testUrl = pattern;
      const response = await fetch(testUrl);
      if (response.ok) {
        return { url: testUrl, source: 'Nintendo CDN (official)' };
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function tryDekuDeals(gameName) {
  try {
    // DekuDeals has game data including screenshots
    const searchUrl = `https://www.dekudeals.com/search?q=${encodeURIComponent(gameName)}`;
    console.log(`   Searching DekuDeals for: ${gameName}`);

    // Note: This would need web scraping or their API if available
    // For now, return null and we'll use other methods
    return null;
  } catch (error) {
    return null;
  }
}

async function tryGoogleImageSearch(gameName) {
  // Use Google Custom Search API or web scraping
  // For this implementation, we'll construct a likely screenshot URL pattern
  // based on common gaming sites

  const searchTerms = [
    `${gameName} nintendo switch screenshot gameplay`,
    `${gameName} switch in-game screenshot`
  ];

  console.log(`   📸 Need to manually search for: "${gameName}"`);
  console.log(`   Search term: ${searchTerms[0]}`);

  // Mark as needing manual intervention
  return {
    url: null,
    source: 'manual_search_required',
    searchTerm: searchTerms[0],
    gameName: gameName
  };
}

async function findScreenshot(gameId, gameName) {
  console.log(`\n🔍 Searching for screenshot: ${gameName}`);

  // Try official sources first
  let result = await tryNintendoCDN(gameId, gameName);
  if (result) {
    console.log(`   ✅ Found on ${result.source}`);
    return result;
  }

  result = await tryDekuDeals(gameName);
  if (result) {
    console.log(`   ✅ Found on DekuDeals`);
    return result;
  }

  // Fall back to web search (unofficial)
  result = await tryGoogleImageSearch(gameName);
  if (result.source === 'manual_search_required') {
    unofficialSources.push({
      gameId,
      gameName,
      searchTerm: result.searchTerm,
      status: 'pending_manual_search'
    });
  }

  return result;
}

async function processGame(client, game) {
  const { id, name } = game;
  const screenshotPath = path.join(OUTPUT_DIR, `${id}_screenshot.jpg`);

  // Check if screenshot already exists locally
  if (fs.existsSync(screenshotPath)) {
    console.log(`   ⏭️  Screenshot already exists locally`);
    return { success: true, source: 'existing_local' };
  }

  // Find screenshot URL
  const result = await findScreenshot(id, name);

  if (!result || !result.url) {
    console.log(`   ⚠️  No automatic source found - added to manual search list`);
    return { success: false, reason: 'manual_search_required' };
  }

  // Download the screenshot
  try {
    await downloadImage(result.url, screenshotPath);
    console.log(`   ✅ Downloaded screenshot`);

    // Update database
    await client.query(
      `UPDATE video_games
       SET image_screenshot_url = $1, updated_at = NOW()
       WHERE id = $2`,
      [`/api/video-games/cached-images/${id}_screenshot.jpg`, id]
    );

    return { success: true, source: result.source };
  } catch (error) {
    console.error(`   ❌ Error downloading: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Find and Download Missing Video Game Screenshots');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get games without screenshots
    const { rows: games } = await client.query(`
      SELECT id, name, publisher
      FROM video_games
      WHERE platform = 'switch'
        AND (image_screenshot_url IS NULL OR image_screenshot_url = '')
      ORDER BY name
    `);

    console.log(`📊 Found ${games.length} games without screenshots\n`);

    const stats = {
      total: games.length,
      downloaded: 0,
      manual_required: 0,
      errors: 0
    };

    // Process each game
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      console.log(`\n[${i + 1}/${games.length}] Processing: ${game.name}`);

      const result = await processGame(client, game);

      if (result.success) {
        stats.downloaded++;
      } else if (result.reason === 'manual_search_required') {
        stats.manual_required++;
      } else {
        stats.errors++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save unofficial sources log
    fs.writeFileSync(
      UNOFFICIAL_SOURCES_LOG,
      JSON.stringify(unofficialSources, null, 2)
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total games:           ${stats.total}`);
    console.log(`   ✅ Downloaded:         ${stats.downloaded}`);
    console.log(`   ⚠️  Manual required:    ${stats.manual_required}`);
    console.log(`   ❌ Errors:             ${stats.errors}`);

    if (unofficialSources.length > 0) {
      console.log(`\n📝 Unofficial sources log saved to: ${UNOFFICIAL_SOURCES_LOG}`);
      console.log(`   ${unofficialSources.length} games require manual screenshot search`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
