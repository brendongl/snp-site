/**
 * Backfill missing screenshots from titledb
 *
 * This script updates games that have landscape/portrait images
 * but are missing screenshots.
 *
 * Usage: node scripts/backfill-missing-screenshots.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function backfillScreenshots() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📸 Backfill Missing Screenshots from titledb');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Fetch titledb
    console.log('📥 Fetching Nintendo titledb...');
    const response = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/US.en.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch titledb: ${response.status}`);
    }
    const titledb = await response.json();
    console.log(`   ✅ Loaded ${Object.keys(titledb).length} titles\n`);

    // Get games missing screenshots
    console.log('📊 Querying for games with missing screenshots...');
    const { rows: games } = await client.query(`
      SELECT id, name, platform_specific_data, image_landscape_url, image_portrait_url
      FROM video_games
      WHERE platform = 'switch'
        AND (image_screenshot_url IS NULL OR image_screenshot_url = '')
        AND (image_landscape_url IS NOT NULL OR image_portrait_url IS NOT NULL)
      ORDER BY name
    `);
    console.log(`   ✅ Found ${games.length} games missing screenshots\n`);

    let updated = 0;
    let skipped = 0;

    console.log('🔄 Updating screenshots...\n');

    for (const game of games) {
      try {
        const data = typeof game.platform_specific_data === 'string'
          ? JSON.parse(game.platform_specific_data)
          : game.platform_specific_data;

        const nsuid = data?.nsuid;
        if (!nsuid) {
          console.log(`   ⊘ Skipping ${game.name} (no NSUID)`);
          skipped++;
          continue;
        }

        const titledbGame = titledb[nsuid];
        if (!titledbGame || !titledbGame.screenshots || titledbGame.screenshots.length === 0) {
          console.log(`   ⊘ Skipping ${game.name} (no screenshot in titledb)`);
          skipped++;
          continue;
        }

        const screenshotUrl = titledbGame.screenshots[0];

        await client.query(`
          UPDATE video_games
          SET
            image_screenshot_url = $1,
            updated_at = NOW()
          WHERE id = $2
        `, [screenshotUrl, game.id]);

        console.log(`   ✅ ${game.name} - Added screenshot`);
        updated++;

      } catch (error) {
        console.error(`   ❌ Error updating ${game.name}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total checked:  ${games.length}`);
    console.log(`   ✅ Updated:     ${updated}`);
    console.log(`   ⊘ Skipped:      ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } finally {
    client.release();
    await pool.end();
  }
}

backfillScreenshots();
