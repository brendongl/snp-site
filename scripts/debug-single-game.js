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

async function debug() {
  const client = await pool.connect();
  try {
    // Get Catan from Airtable
    console.log('1️⃣  Fetching Catan from Airtable...\n');
    const records = await base(tableId).select({
      filterByFormula: "{Game Name} = 'Catan'"
    }).firstPage();

    if (records.length === 0) {
      console.log('   ⚠️  Catan not found in Airtable');
      return;
    }

    const record = records[0];
    const fields = record.fields;

    console.log('   Airtable data for Catan:');
    console.log('   - Cost Price:', fields['Cost Price']);
    console.log('   - Game Size (Rental):', fields['Game Size (Rental)']);
    console.log('   - Deposit:', fields['Deposit']);
    console.log('   - bggID:', fields['bggID']);

    // Check PostgreSQL
    console.log('\n2️⃣  Checking Catan in PostgreSQL...\n');
    const pgResult = await client.query(
      'SELECT id, name, cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      ['Catan']
    );

    if (pgResult.rows.length === 0) {
      console.log('   ⚠️  Catan not found in PostgreSQL');
      return;
    }

    const row = pgResult.rows[0];
    console.log('   PostgreSQL data for Catan:');
    console.log('   - ID:', row.id);
    console.log('   - Name:', row.name);
    console.log('   - cost_price:', row.cost_price);
    console.log('   - game_size:', row.game_size);
    console.log('   - deposit:', row.deposit);
    console.log('   - bgg_id:', row.bgg_id);

    // Try updating manually
    console.log('\n3️⃣  Manually updating Catan...\n');
    await client.query(`
      UPDATE games
      SET
        cost_price = $1,
        game_size = $2,
        deposit = $3,
        bgg_id = $4
      WHERE id = $5
    `, [
      fields['Cost Price'],
      fields['Game Size (Rental)'] ? fields['Game Size (Rental)'].toString() : null,
      fields['Deposit'],
      fields['bggID'] ? fields['bggID'].toString() : null,
      row.id
    ]);

    console.log('   ✓ Updated');

    // Verify update
    const verifyResult = await client.query(
      'SELECT cost_price, game_size, deposit, bgg_id FROM games WHERE name = $1',
      ['Catan']
    );

    console.log('\n4️⃣  Verifying update...\n');
    const updated = verifyResult.rows[0];
    console.log('   - cost_price:', updated.cost_price);
    console.log('   - game_size:', updated.game_size);
    console.log('   - deposit:', updated.deposit);
    console.log('   - bgg_id:', updated.bgg_id);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.release();
    await pool.end();
  }
}

debug();
