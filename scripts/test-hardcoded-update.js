const { Pool } = require('pg');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 Testing Hardcoded Update for 7 Wonders');
console.log('==========================================\n');

const pool = new Pool({ connectionString: connectionUrl });

// Known values from Airtable MCP query
const gameName = '7 Wonders';
const costPrice = 480000;
const gameSize = '2';
const deposit = 450000;
const bggId = '68448';

async function test() {
  const client = await pool.connect();
  try {

    console.log('1️⃣  Finding "7 Wonders" in PostgreSQL...\n');
    const findResult = await client.query(
      'SELECT id, name, cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      [gameName]
    );

    if (findResult.rows.length === 0) {
      console.log('   ⚠️  Game not found in PostgreSQL!');
      return;
    }

    const game = findResult.rows[0];
    console.log('   Found game:');
    console.log('   - ID:', game.id);
    console.log('   - Name:', game.name);
    console.log('   - BEFORE cost_price:', game.cost_price);
    console.log('   - BEFORE game_size:', game.game_size);
    console.log('   - BEFORE deposit:', game.deposit);
    console.log('   - BEFORE bgg_id:', game.bgg_id);

    // 2. Update with transaction
    console.log('\n2️⃣  Updating with transaction...\n');
    console.log('   Values to set:');
    console.log('   - cost_price:', costPrice);
    console.log('   - game_size:', gameSize);
    console.log('   - deposit:', deposit);
    console.log('   - bgg_id:', bggId);

    await client.query('BEGIN');
    console.log('   ✓ BEGIN');

    await client.query(`
      UPDATE games
      SET
        cost_price = $1,
        game_size = $2,
        deposit = $3,
        bgg_id = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [costPrice, gameSize, deposit, bggId, game.id]);

    console.log('   ✓ UPDATE executed');

    await client.query('COMMIT');
    console.log('   ✓ COMMIT');

    // 3. Query again (same connection)
    console.log('\n3️⃣  Querying with SAME connection...\n');
    const afterSame = await client.query(
      'SELECT cost_price, game_size, deposit, bgg_id FROM games WHERE id = $1',
      [game.id]
    );
    const sameResult = afterSame.rows[0];
    console.log('   - cost_price:', sameResult.cost_price);
    console.log('   - game_size:', sameResult.game_size);
    console.log('   - deposit:', sameResult.deposit);
    console.log('   - bgg_id:', sameResult.bgg_id);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.release();
  }

  // 4. Query with NEW connection
  const client2 = await pool.connect();
  try {
    console.log('\n4️⃣  Querying with NEW connection...\n');
    const afterNew = await client2.query(
      'SELECT cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      [gameName]
    );

    if (afterNew.rows.length === 0) {
      console.log('   ⚠️  Game not found!');
      return;
    }

    const newResult = afterNew.rows[0];
    console.log('   - cost_price:', newResult.cost_price);
    console.log('   - game_size:', newResult.game_size);
    console.log('   - deposit:', newResult.deposit);
    console.log('   - bgg_id:', newResult.bgg_id);

    if (newResult.cost_price && newResult.game_size && newResult.deposit && newResult.bgg_id) {
      console.log('\n✅ SUCCESS! Data persisted correctly!');
    } else {
      console.log('\n❌ FAILED! Data did not persist!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client2.release();
    await pool.end();
  }
}

test();
