const { Pool } = require('pg');
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const contentChecksBase = airtable.base('app0vOeBGd6WqBZ9p'); // Content Checker base ID
const contentChecksTable = 'tblTcMUOJy20UEDnp'; // Content Checker table ID

async function migrateContentChecks() {
  const client = await pool.connect();

  try {
    console.log('🔍 Fetching content checks from Airtable...\n');

    const contentChecks = [];

    // Fetch all content checks from Airtable
    await contentChecksBase(contentChecksTable).select({
      view: 'All Content Checks',
    }).eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const gameLinks = record.get('Game'); // Linked game records
        const staffLinks = record.get('Staff Name'); // Linked staff records
        const checkDate = record.get('Check Date');
        const status = record.get('Status');
        const notes = record.get('Notes');

        // Skip if no game linked
        if (!gameLinks || gameLinks.length === 0) {
          return;
        }

        contentChecks.push({
          airtableId: record.id,
          gameAirtableId: gameLinks[0], // First linked game
          staffAirtableId: staffLinks && staffLinks.length > 0 ? staffLinks[0] : null,
          checkDate: checkDate,
          status: status,
          notes: notes || null,
        });
      });

      fetchNextPage();
    });

    console.log(`✅ Found ${contentChecks.length} content checks in Airtable\n`);

    if (contentChecks.length === 0) {
      console.log('⚠️  No content checks found. Nothing to migrate.');
      return;
    }

    // Fetch all games to build ID map (Airtable ID -> PostgreSQL ID)
    console.log('📋 Building game ID mapping...');
    const gameIdMap = new Map();
    await contentChecksBase('tblIuIJN5q3W6oXNr').select({
      fields: ['Game Name'],
      view: 'viwRxfowOlqk8LkAd',
    }).eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        gameIdMap.set(record.id, record.get('Game Name'));
      });
      fetchNextPage();
    });

    // Fetch all staff to build ID map (Airtable ID -> PostgreSQL ID)
    console.log('📋 Building staff ID mapping...');
    const staffIdMap = new Map();
    const staffListBase = airtable.base('apppFvSDh2JBc0qAu');
    await staffListBase('tbljZWaLxiaoLPAb6').select({
      fields: ['Staff Name'],
      view: 'Grid view',
    }).eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        staffIdMap.set(record.id, record.get('Staff Name'));
      });
      fetchNextPage();
    });

    console.log('📝 Migrating content checks to PostgreSQL...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const check of contentChecks) {
      try {
        // Find the game in PostgreSQL by name
        const gameName = gameIdMap.get(check.gameAirtableId);
        if (!gameName) {
          console.log(`⚠️  Skipping: Game Airtable ID ${check.gameAirtableId} not found in mapping`);
          skipCount++;
          continue;
        }

        const gameResult = await client.query(
          'SELECT id FROM games WHERE name = $1 LIMIT 1',
          [gameName]
        );

        if (gameResult.rows.length === 0) {
          console.log(`⚠️  Skipping: Game "${gameName}" not found in PostgreSQL`);
          skipCount++;
          continue;
        }

        const gameId = gameResult.rows[0].id;

        // Find staff in PostgreSQL if linked
        let staffListId = null;
        if (check.staffAirtableId) {
          const staffName = staffIdMap.get(check.staffAirtableId);
          if (staffName) {
            const staffResult = await client.query(
              'SELECT stafflist_id FROM staff_list WHERE staff_name = $1 LIMIT 1',
              [staffName]
            );

            if (staffResult.rows.length > 0) {
              staffListId = staffResult.rows[0].stafflist_id;
            }
          }
        }

        // Generate ID for content check
        const id = `cck_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        // Insert content check into PostgreSQL
        await client.query(
          `INSERT INTO content_checks (
            id, game_id, staff_list_id, check_date, status, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (game_id, check_date) DO NOTHING`,
          [
            id,
            gameId,
            staffListId,
            check.checkDate || new Date().toISOString().split('T')[0],
            check.status || 'Complete',
            check.notes,
          ]
        );

        successCount++;
        if (successCount % 50 === 0) {
          console.log(`   ... processed ${successCount} checks`);
        }

      } catch (error) {
        console.error(`❌ Error processing check ${check.airtableId}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} content checks`);
    console.log(`⚠️  Skipped: ${skipCount} content checks`);
    console.log(`❌ Errors: ${errorCount} content checks`);

    // Verify the results
    const verifyResult = await client.query(`
      SELECT COUNT(*) as total_checks
      FROM content_checks
    `);

    console.log(`\n🔍 Total content checks in PostgreSQL: ${verifyResult.rows[0].total_checks}`);

    // Update game aggregates (latest check info)
    console.log('\n🔄 Updating game aggregates with latest check info...');
    await client.query(`
      UPDATE games g
      SET
        latest_check_date = cc.latest_date,
        latest_check_status = cc.latest_status,
        total_checks = cc.total_count,
        updated_at = NOW()
      FROM (
        SELECT
          game_id,
          MAX(check_date) as latest_date,
          (ARRAY_AGG(status ORDER BY check_date DESC))[1] as latest_status,
          COUNT(*) as total_count
        FROM content_checks
        GROUP BY game_id
      ) cc
      WHERE g.id = cc.game_id
    `);

    console.log('✅ Game aggregates updated successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('🚀 Starting content checks migration from Airtable to PostgreSQL...\n');
migrateContentChecks();
