const { Pool } = require('pg');
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu');
const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';

async function migrateExpansions() {
  const client = await pool.connect();

  try {
    console.log('🔍 Fetching games from Airtable...\n');

    const expansions = [];
    const baseGames = [];

    // Fetch all games from Airtable
    await base(tableId).select({
      fields: ['Game Name', 'Base Game', 'Expansion'],
      view: 'viwRxfowOlqk8LkAd',
    }).eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const gameName = record.get('Game Name');
        const baseGameIds = record.get('Base Game'); // Array of linked record IDs
        const isExpansion = record.get('Expansion'); // Boolean checkbox

        if (baseGameIds && baseGameIds.length > 0) {
          // This game has a base game, so it's an expansion
          expansions.push({
            airtableId: record.id,
            name: gameName,
            baseGameAirtableId: baseGameIds[0], // Take first base game
          });
        } else if (!isExpansion) {
          // This is a base game
          baseGames.push({
            airtableId: record.id,
            name: gameName,
          });
        }
      });

      fetchNextPage();
    });

    console.log(`✅ Found ${baseGames.length} base games`);
    console.log(`✅ Found ${expansions.length} expansions\n`);

    if (expansions.length === 0) {
      console.log('⚠️  No expansions found. Nothing to migrate.');
      return;
    }

    console.log('📝 Updating expansion relationships in PostgreSQL...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const expansion of expansions) {
      try {
        // Find the expansion game in PostgreSQL by matching name
        const expansionResult = await client.query(
          'SELECT id FROM games WHERE name = $1 LIMIT 1',
          [expansion.name]
        );

        if (expansionResult.rows.length === 0) {
          console.log(`⚠️  Skipping: "${expansion.name}" not found in PostgreSQL`);
          skipCount++;
          continue;
        }

        const expansionId = expansionResult.rows[0].id;

        // Fetch the base game from Airtable to get its name
        const baseGameRecord = await base(tableId).find(expansion.baseGameAirtableId);
        const baseGameName = baseGameRecord.get('Game Name');

        // Find the base game in PostgreSQL
        const baseGameResult = await client.query(
          'SELECT id FROM games WHERE name = $1 LIMIT 1',
          [baseGameName]
        );

        if (baseGameResult.rows.length === 0) {
          console.log(`⚠️  Skipping: Base game "${baseGameName}" not found in PostgreSQL`);
          skipCount++;
          continue;
        }

        const baseGameId = baseGameResult.rows[0].id;

        // Update the expansion with base_game_id
        await client.query(
          'UPDATE games SET base_game_id = $1, updated_at = NOW() WHERE id = $2',
          [baseGameId, expansionId]
        );

        console.log(`✅ Linked: "${expansion.name}" → "${baseGameName}"`);
        successCount++;

      } catch (error) {
        console.error(`❌ Error processing "${expansion.name}":`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully linked: ${successCount} expansions`);
    console.log(`⚠️  Skipped: ${skipCount} expansions`);
    console.log(`❌ Errors: ${errorCount} expansions`);

    // Verify the results
    const verifyResult = await client.query(`
      SELECT COUNT(*) as expansion_count
      FROM games
      WHERE base_game_id IS NOT NULL
    `);

    console.log(`\n🔍 Total expansions in PostgreSQL: ${verifyResult.rows[0].expansion_count}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('🚀 Starting expansion migration from Airtable to PostgreSQL...\n');
migrateExpansions();
