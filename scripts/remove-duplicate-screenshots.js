/**
 * Remove Duplicate Screenshot Images
 *
 * Sets screenshot_url to NULL where it equals landscape_url
 * since most games don't have separate screenshot images available
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function removeDuplicateScreenshots() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔍 Finding games with duplicate landscape/screenshot images...\\n');

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
    console.log(`Found ${duplicates.length} games with duplicate images\\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    // Set screenshot to NULL for all duplicates
    const updateResult = await pool.query(`
      UPDATE video_games
      SET image_screenshot_url = NULL, updated_at = NOW()
      WHERE platform = 'switch'
        AND image_landscape_url IS NOT NULL
        AND image_screenshot_url IS NOT NULL
        AND image_landscape_url = image_screenshot_url
    `);

    console.log(`✅ Updated ${updateResult.rowCount} games - set screenshot to NULL\\n`);
    console.log('📝 Note: Most Switch games don\'t have separate screenshot images.');
    console.log('   The UI should handle NULL screenshots gracefully.');

  } finally {
    await pool.end();
  }
}

removeDuplicateScreenshots().catch(console.error);
