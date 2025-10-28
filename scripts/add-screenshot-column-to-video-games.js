/**
 * Add image_screenshot_url column to video_games table
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function addScreenshotColumn() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('Adding image_screenshot_url column to video_games table...\n');

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'video_games'
        AND column_name = 'image_screenshot_url'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✓ Column already exists');
      return;
    }

    // Add the column
    await client.query(`
      ALTER TABLE video_games
      ADD COLUMN image_screenshot_url TEXT
    `);

    console.log('✓ Added image_screenshot_url column');

    // Get count
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM video_games
    `);

    console.log(`\nTotal video games: ${countResult.rows[0].total}`);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addScreenshotColumn().catch(console.error);
