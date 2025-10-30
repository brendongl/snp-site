/**
 * Analyze Screenshot Coverage
 *
 * This script analyzes:
 * 1. Which games have screenshot files locally
 * 2. Which games are missing screenshots
 * 3. Which games have screenshot URLs in the database
 * 4. Recommendations for filling gaps
 *
 * Usage: node scripts/analyze-screenshot-coverage.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const LOCAL_IMAGES_DIR = path.join(__dirname, '..', 'data', 'video-game-images', 'switch');

async function analyzeScreenshots() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📸 Screenshot Coverage Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Check local files
  console.log('📂 Checking local files...');
  if (!fs.existsSync(LOCAL_IMAGES_DIR)) {
    console.error(`❌ Local images directory not found: ${LOCAL_IMAGES_DIR}`);
    process.exit(1);
  }

  const localFiles = fs.readdirSync(LOCAL_IMAGES_DIR);
  const screenshotFiles = localFiles.filter(f => f.endsWith('_screenshot.jpg'));
  const landscapeFiles = localFiles.filter(f => f.endsWith('_landscape.jpg'));
  const portraitFiles = localFiles.filter(f => f.endsWith('_portrait.jpg'));

  // Extract game IDs from filenames
  const gamesWithScreenshots = new Set(screenshotFiles.map(f => f.replace('_screenshot.jpg', '')));
  const gamesWithLandscape = new Set(landscapeFiles.map(f => f.replace('_landscape.jpg', '')));
  const gamesWithPortrait = new Set(portraitFiles.map(f => f.replace('_portrait.jpg', '')));

  console.log(`   📊 Local Files:`);
  console.log(`      - Landscape images:  ${landscapeFiles.length}`);
  console.log(`      - Portrait images:   ${portraitFiles.length}`);
  console.log(`      - Screenshot images: ${screenshotFiles.length}`);
  console.log(`      - Total files:       ${localFiles.length}\n`);

  // 2. Check database
  console.log('🗄️  Checking database...');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const { rows: allGames } = await client.query(`
      SELECT
        id,
        name,
        image_landscape_url,
        image_portrait_url,
        image_screenshot_url
      FROM video_games
      WHERE platform = 'switch'
      ORDER BY name
    `);

    const gamesInDB = allGames.length;
    const gamesWithScreenshotURL = allGames.filter(g => g.image_screenshot_url).length;
    const gamesWithLandscapeURL = allGames.filter(g => g.image_landscape_url).length;
    const gamesWithPortraitURL = allGames.filter(g => g.image_portrait_url).length;

    console.log(`   📊 Database:`);
    console.log(`      - Total games:                ${gamesInDB}`);
    console.log(`      - With landscape URL:         ${gamesWithLandscapeURL}`);
    console.log(`      - With portrait URL:          ${gamesWithPortraitURL}`);
    console.log(`      - With screenshot URL:        ${gamesWithScreenshotURL}`);
    console.log(`      - Missing screenshot URL:     ${gamesInDB - gamesWithScreenshotURL}\n`);

    // 3. Cross-reference: games with local files but no DB URL
    const gamesWithLocalButNoDB = allGames.filter(g => {
      const hasLocalScreenshot = gamesWithScreenshots.has(g.id);
      const hasDBScreenshot = !!g.image_screenshot_url;
      return hasLocalScreenshot && !hasDBScreenshot;
    });

    // 4. Games with DB URL but no local file
    const gamesWithDBButNoLocal = allGames.filter(g => {
      const hasLocalScreenshot = gamesWithScreenshots.has(g.id);
      const hasDBScreenshot = !!g.image_screenshot_url;
      return !hasLocalScreenshot && hasDBScreenshot;
    });

    // 5. Games with neither local file nor DB URL
    const gamesMissingBoth = allGames.filter(g => {
      const hasLocalScreenshot = gamesWithScreenshots.has(g.id);
      const hasDBScreenshot = !!g.image_screenshot_url;
      return !hasLocalScreenshot && !hasDBScreenshot;
    });

    // 6. Games fully covered
    const gamesCovered = allGames.filter(g => {
      const hasLocalScreenshot = gamesWithScreenshots.has(g.id);
      const hasDBScreenshot = !!g.image_screenshot_url;
      return hasLocalScreenshot && hasDBScreenshot;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Coverage Analysis');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ✅ Fully covered (local + DB):         ${gamesCovered.length}`);
    console.log(`   🟡 Has local file, missing DB URL:     ${gamesWithLocalButNoDB.length}`);
    console.log(`   🟠 Has DB URL, missing local file:     ${gamesWithDBButNoLocal.length}`);
    console.log(`   ❌ Missing both (local + DB):          ${gamesMissingBoth.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show some examples
    if (gamesWithLocalButNoDB.length > 0) {
      console.log('🟡 Sample games with local file but no DB URL (first 10):');
      gamesWithLocalButNoDB.slice(0, 10).forEach(g => {
        console.log(`   - ${g.name} (${g.id})`);
      });
      console.log('');
    }

    if (gamesMissingBoth.length > 0) {
      console.log('❌ Sample games missing both (first 10):');
      gamesMissingBoth.slice(0, 10).forEach(g => {
        console.log(`   - ${g.name} (${g.id})`);
      });
      console.log('');
    }

    // 7. Recommendations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 Recommendations');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (gamesWithLocalButNoDB.length > 0) {
      console.log(`\n1️⃣  Update ${gamesWithLocalButNoDB.length} games to use local file URLs`);
      console.log('   Run: node scripts/update-screenshot-urls-to-local.js');
    }

    if (gamesMissingBoth.length > 0) {
      console.log(`\n2️⃣  Download ${gamesMissingBoth.length} missing screenshots from titledb`);
      console.log('   Run: node scripts/backfill-missing-screenshots.js');
    }

    console.log(`\n3️⃣  Include local screenshots in Docker image`);
    console.log('   Action: Modify Dockerfile to copy data/video-game-images/');

    console.log(`\n4️⃣  Deploy to Railway`);
    console.log('   Action: Push to staging, then main branch');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    client.release();
    await pool.end();
  }
}

analyzeScreenshots().catch(console.error);
