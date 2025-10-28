const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function checkMissingImages() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Count games with each type of image
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(image_landscape_url) as has_landscape,
        COUNT(image_portrait_url) as has_portrait,
        COUNT(image_screenshot_url) as has_screenshot
      FROM video_games
      WHERE platform = 'switch'
    `);

    console.log('Image Statistics:');
    console.log(`  Total games: ${stats.rows[0].total}`);
    console.log(`  Has landscape: ${stats.rows[0].has_landscape}`);
    console.log(`  Has portrait: ${stats.rows[0].has_portrait}`);
    console.log(`  Has screenshot: ${stats.rows[0].has_screenshot}`);

    // List games missing landscape images
    const missingLandscape = await client.query(`
      SELECT name
      FROM video_games
      WHERE platform = 'switch'
        AND (image_landscape_url IS NULL OR image_landscape_url = '')
      LIMIT 20
    `);

    console.log(`\nGames missing landscape images (${missingLandscape.rows.length} shown):`);
    missingLandscape.rows.forEach(row => console.log(`  - ${row.name}`));

  } finally {
    client.release();
    await pool.end();
  }
}

checkMissingImages();
