const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function checkUrls() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT name, image_landscape_url
      FROM video_games
      WHERE platform = 'switch'
      LIMIT 5
    `);

    console.log('Current image URLs:');
    result.rows.forEach(row => {
      console.log(`${row.name}: ${row.image_landscape_url}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

checkUrls().catch(console.error);
