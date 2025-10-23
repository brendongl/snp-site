const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway'
});

async function test() {
  const client = await pool.connect();
  try {
    console.log('1️⃣  Starting transaction...\n');
    await client.query('BEGIN');

    // Update Catan
    console.log('2️⃣  Updating Catan...');
    await client.query(`
      UPDATE games
      SET game_size = '4', deposit = 1250000, bgg_id = '13'
      WHERE name = 'Catan'
    `);
    console.log('   ✓ Updated\n');

    // Check BEFORE commit
    console.log('3️⃣  Checking data BEFORE COMMIT...');
    const beforeResult = await client.query(`
      SELECT game_size, deposit, bgg_id
      FROM games
      WHERE name = 'Catan'
    `);
    console.log('   Data:', beforeResult.rows[0]);
    console.log('');

    // COMMIT
    console.log('4️⃣  COMMITTING...');
    await client.query('COMMIT');
    console.log('   ✓ COMMITTED\n');

    // Check AFTER commit (same connection)
    console.log('5️⃣  Checking data AFTER COMMIT (same connection)...');
    const afterResult = await client.query(`
      SELECT game_size, deposit, bgg_id
      FROM games
      WHERE name = 'Catan'
    `);
    console.log('   Data:', afterResult.rows[0]);
    console.log('');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
  }

  // Check with NEW connection
  const client2 = await pool.connect();
  try {
    console.log('6️⃣  Checking data with NEW connection...');
    const newConnResult = await client2.query(`
      SELECT game_size, deposit, bgg_id
      FROM games
      WHERE name = 'Catan'
    `);
    console.log('   Data:', newConnResult.rows[0]);
    console.log('');
  } finally {
    client2.release();
    await pool.end();
  }
}

test();
