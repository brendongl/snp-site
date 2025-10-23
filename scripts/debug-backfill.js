const { Pool } = require('pg');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('🔧 Debug Backfill - Testing Update Mechanism');
console.log('=============================================\n');

const pool = new Pool({ connectionString: connectionUrl });

// Test data from Airtable
const testData = [
  { name: 'Not Alone', cost_price: 500000, game_size: '2', deposit: 600000, bgg_id: '194879' },
  { name: 'Fire Tower', cost_price: 900000, game_size: '3', deposit: 1500000, bgg_id: '226605' },
  { name: 'Love Letter', cost_price: 118000, game_size: '2', deposit: 500000, bgg_id: '129622' },
];

async function debugBackfill() {
  const client = await pool.connect();
  try {
    console.log('1️⃣  Starting transaction...\n');
    await client.query('BEGIN');

    for (const game of testData) {
      console.log(`Processing: ${game.name}`);

      // Find game
      const findResult = await client.query(
        'SELECT id, name FROM games WHERE name = $1',
        [game.name]
      );

      if (findResult.rows.length === 0) {
        console.log(`  ✗ NOT FOUND\n`);
        continue;
      }

      const pgGame = findResult.rows[0];
      console.log(`  Found ID: ${pgGame.id}`);

      // Update
      console.log(`  Updating with values:`);
      console.log(`    cost_price: ${game.cost_price}`);
      console.log(`    game_size: ${game.game_size}`);
      console.log(`    deposit: ${game.deposit}`);
      console.log(`    bgg_id: ${game.bgg_id}`);

      const updateResult = await client.query(`
        UPDATE games
        SET
          cost_price = $1,
          game_size = $2,
          deposit = $3,
          bgg_id = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [game.cost_price, game.game_size, game.deposit, game.bgg_id, pgGame.id]);

      console.log(`  Update rowCount: ${updateResult.rowCount}`);

      // Verify within transaction
      const verifyResult = await client.query(
        'SELECT cost_price, game_size, deposit, bgg_id FROM games WHERE id = $1',
        [pgGame.id]
      );
      const updated = verifyResult.rows[0];
      console.log(`  Verified within transaction:`);
      console.log(`    cost_price: ${updated.cost_price}`);
      console.log(`    game_size: ${updated.game_size}`);
      console.log(`    deposit: ${updated.deposit}`);
      console.log(`    bgg_id: ${updated.bgg_id}`);
      console.log('');
    }

    console.log('2️⃣  COMMITTING transaction...\n');
    await client.query('COMMIT');
    console.log('   ✓ COMMITTED\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error (ROLLED BACK):', error.message);
    console.error(error);
  } finally {
    await client.release();
  }

  // Verify with new connection
  console.log('3️⃣  Verifying with NEW connection...\n');
  const client2 = await pool.connect();
  try {
    for (const game of testData) {
      const result = await client2.query(
        'SELECT name, cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
        [game.name]
      );

      if (result.rows.length > 0) {
        const verified = result.rows[0];
        console.log(`${game.name}:`);
        console.log(`  cost_price: ${verified.cost_price || 'NULL'}`);
        console.log(`  game_size: ${verified.game_size || 'NULL'}`);
        console.log(`  deposit: ${verified.deposit || 'NULL'}`);
        console.log(`  bgg_id: ${verified.bgg_id || 'NULL'}`);

        if (verified.cost_price && verified.game_size && verified.deposit && verified.bgg_id) {
          console.log(`  ✓ SUCCESS!\n`);
        } else {
          console.log(`  ✗ FAILED - Data not persisted!\n`);
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Verification Error:', error.message);
    console.error(error);
  } finally {
    await client2.release();
    await pool.end();
  }
}

debugBackfill();
