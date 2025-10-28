const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function verify() {
  try {
    const result = await pool.query('SELECT COUNT(*) as count, platform FROM video_games GROUP BY platform');
    console.log('✅ Video games in database:');
    result.rows.forEach(row => {
      console.log(`   ${row.platform}: ${row.count} games`);
    });

    const sample = await pool.query('SELECT name, platform, publisher FROM video_games LIMIT 5');
    console.log('\n📝 Sample games:');
    sample.rows.forEach((game, i) => {
      console.log(`   ${i + 1}. ${game.name} (${game.platform}) - ${game.publisher}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

verify();
