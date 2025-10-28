/**
 * Add age_rating column and backfill age ratings from titledb
 *
 * This script:
 * 1. Adds age_rating column to video_games table
 * 2. Fetches titledb data
 * 3. Updates all Switch games with age ratings and rating content
 *
 * Usage: node scripts/add-and-backfill-age-ratings.js
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function addAndBackfillRatings() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎮 Add and Backfill Age Ratings from titledb');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Step 1: Add age_rating column if it doesn't exist
    console.log('📋 Step 1: Adding age_rating column...');
    await client.query(`
      ALTER TABLE video_games
      ADD COLUMN IF NOT EXISTS age_rating INTEGER
    `);
    console.log('   ✅ Column added\n');

    // Step 2: Fetch titledb
    console.log('📥 Step 2: Fetching Nintendo titledb...');
    const response = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/US.en.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch titledb: ${response.status}`);
    }
    const titledb = await response.json();
    console.log(`   ✅ Loaded ${Object.keys(titledb).length} titles\n`);

    // Step 3: Get all Switch games from database
    console.log('📊 Step 3: Querying database for Switch games...');
    const { rows: games } = await client.query(`
      SELECT id, name, platform_specific_data
      FROM video_games
      WHERE platform = 'switch'
      ORDER BY name
    `);
    console.log(`   ✅ Found ${games.length} games\n`);

    // Step 4: Update ratings
    console.log('🔄 Step 4: Updating age ratings and rating content...\n');

    let updated = 0;
    let skipped = 0;
    let errors = 0;

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

        // Extract rating data
        const ageRating = titledbGame.rating || null;
        const ratingContent = titledbGame.ratingContent || null;

        // Update database
        await client.query(`
          UPDATE video_games
          SET
            age_rating = $1,
            rating_content = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [ageRating, ratingContent, game.id]);

        const ratingLabel = ageRating === 6 ? 'E' :
                          ageRating === 10 ? 'E10+' :
                          ageRating === 13 ? 'T' :
                          ageRating === 17 ? 'M' :
                          'Not Rated';

        console.log(`   ✅ ${game.name}`);
        console.log(`      Rating: ${ratingLabel} | Content: ${ratingContent ? ratingContent.join(', ') : 'None'}`);
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
      console.log('   Age ratings available for filtering\n');
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

addAndBackfillRatings().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
