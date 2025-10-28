/**
 * Update Video Game Image URLs to Use Cached Images
 *
 * This script updates the database to use cached local images instead of
 * external Nintendo CDN URLs which return 404.
 *
 * The cached images are named using MD5 hash of the original URL.
 */

const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper: Generate MD5 hash of a string
function md5Hash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function updateImageUrls() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Update Video Game Image URLs to Cached Paths');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get all video games with their current image URLs
    const result = await pool.query(`
      SELECT id, name, image_url, image_landscape_url, image_portrait_url
      FROM video_games
      WHERE image_landscape_url IS NOT NULL
         OR image_portrait_url IS NOT NULL
         OR image_url IS NOT NULL
      ORDER BY name
    `);

    console.log(`📊 Found ${result.rows.length} video games with image URLs\n`);

    let updated = 0;
    let failed = 0;

    for (const game of result.rows) {
      try {
        const updates = {};

        // Update main image URL
        if (game.image_url && game.image_url.includes('nintendo.com')) {
          const hash = md5Hash(game.image_url);
          updates.image_url = `/api/video-games/cached-images/${hash}.jpg`;
        }

        // Update landscape URL
        if (game.image_landscape_url && game.image_landscape_url.includes('nintendo.com')) {
          const hash = md5Hash(game.image_landscape_url);
          updates.image_landscape_url = `/api/video-games/cached-images/${hash}.jpg`;
        }

        // Update portrait URL
        if (game.image_portrait_url && game.image_portrait_url.includes('nintendo.com')) {
          const hash = md5Hash(game.image_portrait_url);
          updates.image_portrait_url = `/api/video-games/cached-images/${hash}.jpg`;
        }

        if (Object.keys(updates).length > 0) {
          // Build UPDATE query dynamically
          const setClause = Object.keys(updates)
            .map((key, i) => `${key} = $${i + 1}`)
            .join(', ');

          const values = Object.values(updates);
          values.push(game.id);

          await pool.query(
            `UPDATE video_games SET ${setClause} WHERE id = $${values.length}`,
            values
          );

          updated++;
          console.log(`✅ ${game.name} (${game.id})`);
        }

      } catch (error) {
        failed++;
        console.error(`❌ ${game.name}: ${error.message}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Update Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`   Total games:  ${result.rows.length}`);
    console.log(`   Updated:      ${updated} ✅`);
    console.log(`   Failed:       ${failed} ❌`);
    console.log('');
    console.log('Next step: Visit https://staging-production-c398.up.railway.app/video-games');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Update failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateImageUrls();
