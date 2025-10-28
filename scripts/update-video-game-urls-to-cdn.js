/**
 * Update Video Game Image URLs to Use External CDN
 *
 * Changes image URLs from local /api endpoints to direct Nintendo CDN URLs
 * from Blawar's titledb. This bypasses the need for persistent volume storage.
 *
 * Usage:
 *   node scripts/update-video-game-urls-to-cdn.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function updateToCDNUrls() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Update Video Game URLs to External CDN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Fetch titledb data
    console.log('📥 Fetching Nintendo titledb...');
    const response = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/US.en.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch titledb: ${response.status}`);
    }

    const titledb = await response.json();
    console.log(`   ✅ Loaded ${Object.keys(titledb).length} titles\n`);

    // Get all Switch games from database
    console.log('📊 Querying database for Switch games...');
    const { rows: games } = await client.query(`
      SELECT id, name, platform_specific_data
      FROM video_games
      WHERE platform = 'switch'
      ORDER BY name
    `);
    console.log(`   ✅ Found ${games.length} games\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('🔄 Updating image URLs...\n');

    for (const game of games) {
      try {
        // Parse platform_specific_data to get NSUID
        const data = typeof game.platform_specific_data === 'string'
          ? JSON.parse(game.platform_specific_data)
          : game.platform_specific_data;

        const nsuid = data?.nsuid;
        if (!nsuid) {
          console.log(`   ⊘ Skipping ${game.name} (no NSUID)`);
          skipped++;
          continue;
        }

        // Look up in titledb
        const titledbGame = titledb[nsuid];
        if (!titledbGame) {
          console.log(`   ⊘ Skipping ${game.name} (not in titledb)`);
          skipped++;
          continue;
        }

        // Extract CDN URLs
        const bannerUrl = titledbGame.bannerUrl || null;
        const iconUrl = titledbGame.iconUrl || null;
        const screenshotUrl = titledbGame.screenshots?.[0] || null;

        if (!bannerUrl && !iconUrl && !screenshotUrl) {
          console.log(`   ⊘ Skipping ${game.name} (no images in titledb)`);
          skipped++;
          continue;
        }

        // Update database with CDN URLs
        await client.query(`
          UPDATE video_games
          SET
            image_landscape_url = $1,
            image_portrait_url = $2,
            image_screenshot_url = $3,
            updated_at = NOW()
          WHERE id = $4
        `, [bannerUrl, iconUrl, screenshotUrl, game.id]);

        console.log(`   ✅ ${game.name}`);
        console.log(`      Landscape: ${bannerUrl ? '✓' : '✗'} | Portrait: ${iconUrl ? '✓' : '✗'} | Screenshot: ${screenshotUrl ? '✓' : '✗'}`);
        updated++;

      } catch (error) {
        console.error(`   ❌ Error updating ${game.name}:`, error.message);
        errors++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Update Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total games:  ${games.length}`);
    console.log(`   ✅ Updated:   ${updated}`);
    console.log(`   ⊘ Skipped:    ${skipped}`);
    console.log(`   ❌ Errors:    ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (updated > 0) {
      console.log('✅ Database updated successfully!');
      console.log('   Images will now load directly from Nintendo CDN\n');
    } else {
      console.log('⚠️  No games were updated\n');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateToCDNUrls().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
