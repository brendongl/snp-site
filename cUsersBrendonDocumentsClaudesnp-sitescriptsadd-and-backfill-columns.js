const { Pool } = require('pg');
const Airtable = require('airtable');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';

if (!airtableApiKey) {
  console.error('❌ AIRTABLE_API_KEY environment variable is required');
  process.exit(1);
}

console.log('📦 PostgreSQL Migration: Add Missing Columns & Backfill from Airtable');
console.log('========================================================================\n');

const pool = new Pool({ connectionString: connectionUrl });
const base = new Airtable({ apiKey: airtableApiKey }).base(baseId);

async function migrate() {
  const client = await pool.connect();
  try {
    // Step 1: Add missing columns
    console.log('\n1️⃣  Adding missing columns...');
    
    const columnsToAdd = [
      { name: 'cost_price', type: 'DECIMAL(10,2)', airtableField: 'Cost Price' },
      { name: 'game_size', type: 'VARCHAR(10)', airtableField: 'Game Size (Rental)' },
      { name: 'deposit', type: 'DECIMAL(10,2)', airtableField: 'Deposit' },
      { name: 'bgg_id', type: 'VARCHAR(50)', airtableField: 'BGG ID' },
      { name: 'min_playtime', type: 'INTEGER', airtableField: 'Min Play Time' },
      { name: 'max_playtime', type: 'INTEGER', airtableField: 'Max Play Time' },
    ];

    for (const column of columnsToAdd) {
      try {
        await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`);
        console.log(`   ✓ Added/verified column: ${column.name}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`   ℹ️  Column ${column.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    // Step 2: Create indexes
    console.log('\n2️⃣  Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_games_bgg_id ON games(bgg_id)`);
    console.log('   ✓ Created index on bgg_id');

    // Step 3: Fetch all records from Airtable
    console.log('\n3️⃣  Fetching games from Airtable...');
    const airtableRecords = [];
    
    await base(tableId).select({
      view: 'Main View'
    }).eachPage((records, fetchNextPage) => {
      records.forEach(record => airtableRecords.push(record));
      fetchNextPage();
    });

    console.log(`   ✓ Fetched ${airtableRecords.length} games from Airtable`);

    // Step 4: Update PostgreSQL with Airtable data
    console.log('\n4️⃣  Backfilling data from Airtable to PostgreSQL...');
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
            min_playtime = $5,
            max_playtime = $6,
            updated_at = NOW()
          WHERE id = $7
        `, [
          fields['Cost Price'] || null,
          fields['Game Size (Rental)'] ? fields['Game Size (Rental)'].toString() : null,
          fields['Deposit'] || null,
          fields['BGG ID'] ? fields['BGG ID'].toString() : null,
          fields['Min Play Time'] || null,
          fields['Max Play Time'] || null,
          gameId
        ]);

        updated++;
      } catch (err) {
        console.error(`   ❌ Error updating ${gameName}:`, err.message);
      }
    }

    console.log(`\n   ✓ Updated ${updated} games`);
    console.log(`   ℹ️  Skipped ${skipped} games`);

    console.log('\n✅ Migration and backfill completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

migrate();
