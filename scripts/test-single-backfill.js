const { Pool } = require('pg');
const Airtable = require('airtable');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apppFvSDh2JBc0qAu';
const tableId = 'tblIuIJN5q3W6oXNr';

if (!airtableApiKey) {
  console.error('❌ Missing AIRTABLE_API_KEY');
  process.exit(1);
}

const pool = new Pool({ connectionString: connectionUrl });
const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

async function testSingleBackfill() {
  const client = await pool.connect();
  try {
    // 1. Get "7 Wonders" from Airtable
    console.log('1️⃣  Fetching "7 Wonders" from Airtable...\n');
    const records = await base(tableId).select({
      filterByFormula: "{Game Name} = '7 Wonders'"
    }).firstPage();

    if (records.length === 0) {
      console.log('   ⚠️  Game not found in Airtable');
      return;
    }

    const record = records[0];
    const fields = record.fields;
    console.log('   Airtable data:');
    console.log('   - Cost Price:', fields['Cost Price']);
    console.log('   - Game Size:', fields['Game Size (Rental)']);
    console.log('   - Deposit:', fields['Deposit']);
    console.log('   - bggID:', fields['bggID']);

    // 2. Find in PostgreSQL
    console.log('\n2️⃣  Finding "7 Wonders" in PostgreSQL...\n');
    const pgResult = await client.query(
      'SELECT id, name, cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      ['7 Wonders']
    );

    if (pgResult.rows.length === 0) {
      console.log('   ⚠️  Game not found in PostgreSQL');
      return;
    }

    const game = pgResult.rows[0];
    console.log('   BEFORE update:');
    console.log('   - ID:', game.id);
    console.log('   - cost_price:', game.cost_price);
    console.log('   - game_size:', game.game_size);
    console.log('   - deposit:', game.deposit);
    console.log('   - bgg_id:', game.bgg_id);

    // 3. Update with transaction
    console.log('\n3️⃣  Updating with transaction...\n');
    await client.query('BEGIN');

    const updateValues = [
      fields['Cost Price'] || null,
      fields['Game Size (Rental)'] ? fields['Game Size (Rental)'].toString() : null,
      fields['Deposit'] || null,
      fields['bggID'] ? fields['bggID'].toString() : null,
      game.id
    ];

    console.log('   Update values:', updateValues);

    await client.query(`
      UPDATE games
      SET
        cost_price = $1,
        game_size = $2,
        deposit = $3,
        bgg_id = $4,
        updated_at = NOW()
      WHERE id = $5
    `, updateValues);

    await client.query('COMMIT');
    console.log('   ✓ COMMITTED');

    // 4. Query again (same connection)
    console.log('\n4️⃣  Querying again (same connection)...\n');
    const afterResult = await client.query(
      'SELECT cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      ['7 Wonders']
    );
    const after = afterResult.rows[0];
    console.log('   AFTER update (same connection):');
    console.log('   - cost_price:', after.cost_price);
    console.log('   - game_size:', after.game_size);
    console.log('   - deposit:', after.deposit);
    console.log('   - bgg_id:', after.bgg_id);

    // 5. Release and query with new connection
    await client.release();
    const client2 = await pool.connect();

    console.log('\n5️⃣  Querying with NEW connection...\n');
    const newConnResult = await client2.query(
      'SELECT cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      ['7 Wonders']
    );
    const newConn = newConnResult.rows[0];
    console.log('   AFTER update (new connection):');
    console.log('   - cost_price:', newConn.cost_price);
    console.log('   - game_size:', newConn.game_size);
    console.log('   - deposit:', newConn.deposit);
    console.log('   - bgg_id:', newConn.bgg_id);

    await client2.release();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

testSingleBackfill();
