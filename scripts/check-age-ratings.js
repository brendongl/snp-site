const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function checkRatings() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Check distribution
    const dist = await client.query(`
      SELECT age_rating, COUNT(*) as count
      FROM video_games
      WHERE platform = 'switch'
      GROUP BY age_rating
      ORDER BY age_rating
    `);

    console.log('Age rating distribution:');
    dist.rows.forEach(row => {
      const label = row.age_rating === 6 ? 'E' :
                   row.age_rating === 10 ? 'E10+' :
                   row.age_rating === 13 ? 'T' :
                   row.age_rating === 17 ? 'M' :
                   row.age_rating === null ? 'NULL' : row.age_rating;
      console.log(`  ${label} (${row.age_rating}): ${row.count} games`);
    });

    // Sample games with ratings
    console.log('\nSample games with ratings:');
    const sample = await client.query(`
      SELECT name, age_rating, image_landscape_url, image_portrait_url, image_screenshot_url
      FROM video_games
      WHERE platform = 'switch' AND age_rating IS NOT NULL
      LIMIT 5
    `);
    sample.rows.forEach(game => {
      const label = game.age_rating === 6 ? 'E' :
                   game.age_rating === 10 ? 'E10+' :
                   game.age_rating === 13 ? 'T' :
                   game.age_rating === 17 ? 'M' : game.age_rating;
      const hasLandscape = game.image_landscape_url ? '✓' : '✗';
      const hasPortrait = game.image_portrait_url ? '✓' : '✗';
      const hasScreenshot = game.image_screenshot_url ? '✓' : '✗';
      console.log(`  ${game.name} - ${label}`);
      console.log(`    Images: L:${hasLandscape} P:${hasPortrait} S:${hasScreenshot}`);
    });

  } finally {
    client.release();
    await pool.end();
  }
}

checkRatings();
