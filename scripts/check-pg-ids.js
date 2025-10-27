const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
  ssl: false
});

async function check() {
  const result = await pool.query('SELECT id, game_id, check_date, inspector_id FROM content_checks ORDER BY check_date DESC LIMIT 10');
  console.log('\nPostgreSQL content_checks sample IDs:');
  result.rows.forEach(row => {
    console.log(`  - ID: ${row.id}`);
    console.log(`    Game: ${row.game_id}`);
    console.log(`    Date: ${row.check_date}`);
    console.log(`    Inspector: ${row.inspector_id || 'NULL'}`);
    console.log('');
  });
  await pool.end();
}

check().catch(console.error);
