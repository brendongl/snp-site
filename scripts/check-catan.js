const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway'
});

async function check() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT name, cost_price, game_size, deposit, bgg_id
      FROM games
      WHERE name IN ('Catan', 'Barcelona', 'Catan: Seafarers')
      ORDER BY name
    `);

    console.log('\n📋 Data for Catan games:\n');
    result.rows.forEach(row => {
      console.log(`Game: ${row.name}`);
      console.log(`  cost_price: ${row.cost_price}`);
      console.log(`  game_size: ${row.game_size}`);
      console.log(`  deposit: ${row.deposit}`);
      console.log(`  bgg_id: ${row.bgg_id}`);
      console.log('');
    });

    // Count games with data
    const countResult = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE bgg_id IS NOT NULL) as bgg_count,
        COUNT(*) FILTER (WHERE game_size IS NOT NULL) as size_count,
        COUNT(*) FILTER (WHERE deposit IS NOT NULL) as deposit_count,
        COUNT(*) FILTER (WHERE cost_price IS NOT NULL) as cost_count
      FROM games
    `);

    console.log('📊 Total counts:');
    console.log(`  Games with BGG ID: ${countResult.rows[0].bgg_count}`);
    console.log(`  Games with Game Size: ${countResult.rows[0].size_count}`);
    console.log(`  Games with Deposit: ${countResult.rows[0].deposit_count}`);
    console.log(`  Games with Cost Price: ${countResult.rows[0].cost_count}`);

  } finally {
    await client.release();
    await pool.end();
  }
}

check();
