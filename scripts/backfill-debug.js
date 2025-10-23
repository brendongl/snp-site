const { Pool } = require('pg');
const Airtable = require('airtable');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apppFvSDh2JBc0qAu';
const tableId = 'tblIuIJN5q3W6oXNr';
const viewId = 'viwRxfowOlqk8LkAd';

if (!airtableApiKey) {
  console.error('❌ Missing AIRTABLE_API_KEY');
  process.exit(1);
}

const pool = new Pool({ connectionString: connectionUrl });
const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

async function backfill() {
  const client = await pool.connect();
  try {
    // Get just Catan-related games
    console.log('Fetching Catan games from Airtable...\n');
    const airtableRecords = [];

    await base(tableId).select({
      filterByFormula: "OR(FIND('Catan', {Game Name}), {Game Name} = 'Barcelona')"
    }).eachPage((records, fetchNextPage) => {
      records.forEach(record => airtableRecords.push(record));
      fetchNextPage();
    });

    console.log(`Found ${airtableRecords.length} Catan-related games\n`);

    for (const record of airtableRecords) {
      const fields = record.fields;
      const gameName = fields['Game Name'];

      console.log(`Processing: ${gameName}`);
      console.log(`  Airtable bggID: ${fields['bggID']}`);
      console.log(`  Airtable Game Size: ${fields['Game Size (Rental)']}`);
      console.log(`  Airtable Deposit: ${fields['Deposit']}`);
      console.log(`  Airtable Cost Price: ${fields['Cost Price']}`);

      // Find in PostgreSQL
      const pgResult = await client.query(
        'SELECT id FROM games WHERE name = $1',
        [gameName]
      );

      if (pgResult.rows.length === 0) {
        console.log(`  ⚠️  Not found in PostgreSQL\n`);
        continue;
      }

      const gameId = pgResult.rows[0].id;

      // Update
      const updateResult = await client.query(`
        UPDATE games
        SET
          cost_price = $1,
          game_size = $2,
          deposit = $3,
          bgg_id = $4
        WHERE id = $5
        RETURNING cost_price, game_size, deposit, bgg_id
      `, [
        fields['Cost Price'] || null,
        fields['Game Size (Rental)'] ? fields['Game Size (Rental)'].toString() : null,
        fields['Deposit'] || null,
        fields['bggID'] ? fields['bggID'].toString() : null,
        gameId
      ]);

      const updated = updateResult.rows[0];
      console.log(`  ✓ Updated in PostgreSQL:`);
      console.log(`    cost_price: ${updated.cost_price}`);
      console.log(`    game_size: ${updated.game_size}`);
      console.log(`    deposit: ${updated.deposit}`);
      console.log(`    bgg_id: ${updated.bgg_id}\n`);
    }

    console.log('✅ Done!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.release();
    await pool.end();
  }
}

backfill();
