const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('Database connection:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

    const countResult = await pool.query('SELECT COUNT(*) FROM video_games');
    console.log('Total video_games records:', countResult.rows[0].count);

    const sampleResult = await pool.query('SELECT id, name, image_landscape_url FROM video_games LIMIT 3');
    console.log('\nSample records:');
    sampleResult.rows.forEach(row => {
      console.log(`  - ${row.name}`);
      console.log(`    Landscape URL: ${row.image_landscape_url || 'NULL'}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
