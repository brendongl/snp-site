const { Pool } = require('pg');
const Airtable = require('airtable');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = 'apppFvSDh2JBc0qAu';
const tableId = 'tblIuIJN5q3W6oXNr';
const viewId = 'viwRxfowOlqk8LkAd';

if (!airtableApiKey) {
  console.error('❌ AIRTABLE_API_KEY environment variable is required');
  process.exit(1);
}

console.log('📦 Backfilling Data from Airtable to PostgreSQL');
console.log('=================================================\n');

const pool = new Pool({ connectionString: connectionUrl });
const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

async function backfill() {
  let client;
  try {
    // Fetch all records from Airtable
    console.log('1️⃣  Fetching games from Airtable...');
    const airtableRecords = [];

    await base(tableId).select({
      view: viewId
    }).eachPage((records, fetchNextPage) => {
      records.forEach(record => airtableRecords.push(record));
      fetchNextPage();
    });

    console.log(`   ✓ Fetched ${airtableRecords.length} games from Airtable\n`);

    // Get client and start transaction
    client = await pool.connect();
    await client.query('BEGIN');
    console.log('2️⃣  Starting transaction...\n');

    // Update PostgreSQL with Airtable data
    console.log('3️⃣  Backfilling data to PostgreSQL...');
    let updated = 0;
    let skipped = 0;

    for (const record of airtableRecords) {
      const fields = record.fields;
      const gameName = fields['Game Name'];

      if (!gameName) {
        skipped++;
        continue;
      }

      try {
        // Find the game in PostgreSQL by name
        const pgResult = await client.query(
          'SELECT id FROM games WHERE name = $1 LIMIT 1',
          [gameName]
        );

        if (pgResult.rows.length === 0) {
          console.log(`   ⚠️  Game not found in PostgreSQL: ${gameName}`);
          skipped++;
          continue;
        }

        const gameId = pgResult.rows[0].id;

        // Update with Airtable data
        await client.query(`
          UPDATE games
          SET
            cost_price = $1,
            game_size = $2,
            deposit = $3,
            bgg_id = $4,
            updated_at = NOW()
          WHERE id = $5
        `, [
          fields['Cost Price'] || null,
          fields['Game Size (Rental)'] ? fields['Game Size (Rental)'].toString() : null,
          fields['Deposit'] || null,
          fields['bggID'] ? fields['bggID'].toString() : null,
          gameId
        ]);

        updated++;
        if (updated % 50 === 0) {
          console.log(`   ... updated ${updated} games`);
        }
      } catch (err) {
        console.error(`   ❌ Error updating ${gameName}:`, err.message);
      }
    }

    // COMMIT the transaction
    await client.query('COMMIT');
    console.log('\n   ✓ COMMITTED transaction');

    console.log(`\n   ✓ Updated ${updated} games`);
    console.log(`   ℹ️  Skipped ${skipped} games`);

    console.log('\n✅ Backfill completed successfully!');

  } catch (error) {
    // ROLLBACK on error
    if (client) {
      await client.query('ROLLBACK');
      console.log('\n   ⚠️  ROLLED BACK transaction');
    }
    console.error('\n❌ Backfill failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

backfill();
