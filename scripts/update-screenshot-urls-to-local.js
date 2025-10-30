/**
 * Update Screenshot URLs to Use Local Files
 *
 * This script updates the database to point to local screenshot files
 * that exist in data/video-game-images/switch/
 *
 * After Dockerfile includes these images, this script ensures the database
 * URLs point to the correct local paths accessible via API route.
 *
 * Usage: node scripts/update-screenshot-urls-to-local.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const LOCAL_IMAGES_DIR = path.join(__dirname, '..', 'data', 'video-game-images', 'switch');

async function updateScreenshotURLs() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Update Screenshot URLs to Local Files');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
  }

  // Check local files
  console.log('📂 Checking local screenshot files...');
  if (!fs.existsSync(LOCAL_IMAGES_DIR)) {
    console.error(`❌ Directory not found: ${LOCAL_IMAGES_DIR}`);
    process.exit(1);
  }

  const localFiles = fs.readdirSync(LOCAL_IMAGES_DIR);
  const screenshotFiles = localFiles.filter(f => f.endsWith('_screenshot.jpg'));
  const landscapeFiles = localFiles.filter(f => f.endsWith('_landscape.jpg'));
  const portraitFiles = localFiles.filter(f => f.endsWith('_portrait.jpg'));

  console.log(`   📊 Found locally:`);
  console.log(`      - Landscape:  ${landscapeFiles.length}`);
  console.log(`      - Portrait:   ${portraitFiles.length}`);
  console.log(`      - Screenshot: ${screenshotFiles.length}\n`);

  // Build lookup maps
  const screenshotMap = new Map();
  const landscapeMap = new Map();
  const portraitMap = new Map();

  screenshotFiles.forEach(f => {
    const gameId = f.replace('_screenshot.jpg', '');
    screenshotMap.set(gameId, `/api/video-games/cached-images/${f}`);
  });

  landscapeFiles.forEach(f => {
    const gameId = f.replace('_landscape.jpg', '');
    landscapeMap.set(gameId, `/api/video-games/cached-images/${f}`);
  });

  portraitFiles.forEach(f => {
    const gameId = f.replace('_portrait.jpg', '');
    portraitMap.set(gameId, `/api/video-games/cached-images/${f}`);
  });

  // Connect to database
  console.log('🗄️  Connecting to database...');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Get all Switch games
    const { rows: games } = await client.query(`
      SELECT id, name
      FROM video_games
      WHERE platform = 'switch'
      ORDER BY name
    `);

    console.log(`   ✅ Found ${games.length} Switch games in database\n`);

    let updatedScreenshot = 0;
    let updatedLandscape = 0;
    let updatedPortrait = 0;
    let skipped = 0;

    console.log('🔄 Updating URLs...\n');

    for (const game of games) {
      try {
        const updates = [];
        const values = [];
        let paramCount = 1;

        // Check for screenshot
        if (screenshotMap.has(game.id)) {
          updates.push(`image_screenshot_url = $${paramCount++}`);
          values.push(screenshotMap.get(game.id));
          updatedScreenshot++;
        }

        // Check for landscape
        if (landscapeMap.has(game.id)) {
          updates.push(`image_landscape_url = $${paramCount++}`);
          values.push(landscapeMap.get(game.id));
          updatedLandscape++;
        }

        // Check for portrait
        if (portraitMap.has(game.id)) {
          updates.push(`image_portrait_url = $${paramCount++}`);
          values.push(portraitMap.get(game.id));
          updatedPortrait++;
        }

        if (updates.length === 0) {
          skipped++;
          continue;
        }

        // Add updated_at
        updates.push(`updated_at = NOW()`);

        // Add game ID for WHERE clause
        values.push(game.id);

        const query = `
          UPDATE video_games
          SET ${updates.join(', ')}
          WHERE id = $${paramCount}
        `;

        await client.query(query, values);

        if (updates.length > 1) { // More than just updated_at
          console.log(`   ✅ ${game.name} - Updated ${updates.length - 1} image URLs`);
        }

      } catch (error) {
        console.error(`   ❌ Error updating ${game.name}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total games:        ${games.length}`);
    console.log(`   ✅ Screenshot URLs: ${updatedScreenshot}`);
    console.log(`   ✅ Landscape URLs:  ${updatedLandscape}`);
    console.log(`   ✅ Portrait URLs:   ${updatedPortrait}`);
    console.log(`   ⊘ Skipped:          ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    client.release();
    await pool.end();
  }
}

updateScreenshotURLs().catch(console.error);
