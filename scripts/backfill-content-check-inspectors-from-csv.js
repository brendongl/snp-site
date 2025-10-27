/**
 * Backfill missing inspector_id in content_checks table from CSV export
 *
 * This script:
 * 1. Reads CSV from Airtable export
 * 2. Maps inspector names to staff_list.stafflist_id
 * 3. UPDATEs existing content_checks records (NO DUPLICATES)
 * 4. Leaves NULL for records without inspectors
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const csv = require('csv-parser');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

// Path to CSV file (adjust if needed)
const CSV_FILE_PATH = './Content Check Log-Grid view.csv';

async function backfillInspectors() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Backfilling content check inspector IDs from CSV...\n');

    // Step 1: Build staff name → stafflist_id mapping
    console.log('📋 Building staff name mapping...');
    const staffMapping = new Map();

    const staffResult = await pool.query(`
      SELECT stafflist_id, staff_name
      FROM staff_list
      ORDER BY staff_name
    `);

    staffResult.rows.forEach(row => {
      // Store both exact name and normalized version for fuzzy matching
      staffMapping.set(row.staff_name.trim(), row.stafflist_id);

      // Also store normalized version (lowercase, no extra spaces)
      const normalized = row.staff_name.trim().toLowerCase().replace(/\s+/g, ' ');
      staffMapping.set(normalized, row.stafflist_id);
    });

    console.log(`✅ Loaded ${staffResult.rows.length} staff members`);
    console.log('\nStaff mapping sample:');
    let count = 0;
    for (const [name, id] of staffMapping.entries()) {
      if (count++ < 5) {
        console.log(`  - "${name}" → ${id}`);
      }
    }

    // Step 2: Build game name → game_id mapping
    console.log('\n📋 Building game name mapping...');
    const gameMapping = new Map();

    const gameResult = await pool.query(`
      SELECT id, name
      FROM games
      ORDER BY name
    `);

    gameResult.rows.forEach(row => {
      // Store both exact name and normalized version for fuzzy matching
      gameMapping.set(row.name.trim(), row.id);

      // Also store normalized version (lowercase, no extra spaces)
      const normalized = row.name.trim().toLowerCase().replace(/\s+/g, ' ');
      gameMapping.set(normalized, row.id);
    });

    console.log(`✅ Loaded ${gameResult.rows.length} games`);
    console.log('\nGame mapping sample:');
    count = 0;
    for (const [name, id] of gameMapping.entries()) {
      if (count++ < 5) {
        console.log(`  - "${name}" → ${id}`);
      }
    }

    // Step 3: Read CSV file
    console.log('\n📥 Reading CSV file...');
    const csvRecords = [];

    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          // CSV columns: Board Game, Check Date, Inspector, Status, etc.
          csvRecords.push({
            inspector: row.Inspector?.trim(),
            boardGame: row['Board Game']?.trim(),
            checkDate: row['Check Date']?.trim(), // MM/DD/YYYY format
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`✅ Read ${csvRecords.length} records from CSV`);

    // Step 4: Process each record
    console.log('\n🔄 Processing records...\n');

    let updated = 0;
    let skippedNoInspector = 0;
    let skippedInspectorNotFound = 0;
    let skippedGameNotFound = 0;
    let skippedNoDate = 0;
    let skippedNoGame = 0;
    let errors = 0;
    let notInDb = 0;
    let alreadyHasInspector = 0;

    const unmatchedInspectors = new Set();
    const unmatchedGames = new Set();

    for (const record of csvRecords) {
      try {
        // Skip if no game name
        if (!record.boardGame) {
          skippedNoGame++;
          continue;
        }

        // Skip if no check date
        if (!record.checkDate) {
          skippedNoDate++;
          continue;
        }

        // Convert date from MM/DD/YYYY to YYYY-MM-DD
        const dateParts = record.checkDate.split('/');
        if (dateParts.length !== 3) {
          console.log(`  ⚠️  Invalid date format: ${record.checkDate} (${record.boardGame})`);
          errors++;
          continue;
        }
        const [month, day, year] = dateParts;
        const checkDateISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

        // Find game_id from game name
        let gameId = gameMapping.get(record.boardGame);
        if (!gameId) {
          const normalized = record.boardGame.toLowerCase().replace(/\s+/g, ' ');
          gameId = gameMapping.get(normalized);
        }

        if (!gameId) {
          skippedGameNotFound++;
          unmatchedGames.add(record.boardGame);
          if (skippedGameNotFound <= 10) {
            console.log(`  ❌ Game not found: "${record.boardGame}"`);
          }
          continue;
        }

        // Check if record exists in PostgreSQL by game_id + check_date
        const existsResult = await pool.query(
          `SELECT id, inspector_id FROM content_checks
           WHERE game_id = $1 AND DATE(check_date) = $2
           LIMIT 1`,
          [gameId, checkDateISO]
        );

        if (existsResult.rows.length === 0) {
          // Record not in database
          notInDb++;
          if (notInDb <= 10) {
            console.log(`  ⚠️  Not in DB: ${record.boardGame} on ${record.checkDate}`);
          }
          continue;
        }

        const pgRecord = existsResult.rows[0];
        const currentInspectorId = pgRecord.inspector_id;

        // Skip if already has inspector_id
        if (currentInspectorId) {
          alreadyHasInspector++;
          continue;
        }

        // Skip if no inspector in CSV (leave as NULL)
        if (!record.inspector || record.inspector === '') {
          skippedNoInspector++;
          continue;
        }

        // Try to find matching stafflist_id
        let stafflistId = staffMapping.get(record.inspector);

        // If not found, try normalized version
        if (!stafflistId) {
          const normalized = record.inspector.toLowerCase().replace(/\s+/g, ' ');
          stafflistId = staffMapping.get(normalized);
        }

        if (!stafflistId) {
          skippedInspectorNotFound++;
          unmatchedInspectors.add(record.inspector);
          if (skippedInspectorNotFound <= 10) {
            console.log(`  ❌ Inspector not found: "${record.inspector}" (${record.boardGame})`);
          }
          continue;
        }

        // UPDATE the record with inspector_id
        await pool.query(
          `UPDATE content_checks
           SET inspector_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [stafflistId, pgRecord.id]
        );

        updated++;

        // Progress indicator
        if (updated % 50 === 0) {
          console.log(`  ✅ Updated ${updated} records...`);
        }
      } catch (error) {
        console.error(`  ❌ Error processing record ${record.boardGame} (${record.checkDate}):`, error.message);
        errors++;
      }
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('BACKFILL COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Results:`);
    console.log(`   Total CSV records: ${csvRecords.length}`);
    console.log(`   ✅ Updated with inspector_id: ${updated}`);
    console.log(`   ⏭️  Already had inspector_id: ${alreadyHasInspector}`);
    console.log(`   ⚠️  Skipped (no inspector in CSV): ${skippedNoInspector}`);
    console.log(`   ⚠️  Skipped (inspector not found in staff_list): ${skippedInspectorNotFound}`);
    console.log(`   ⚠️  Skipped (game not found in database): ${skippedGameNotFound}`);
    console.log(`   ⚠️  Skipped (no game name): ${skippedNoGame}`);
    console.log(`   ⚠️  Skipped (no check date): ${skippedNoDate}`);
    console.log(`   ⚠️  Not in PostgreSQL database: ${notInDb}`);
    console.log(`   ❌ Errors: ${errors}`);

    if (unmatchedInspectors.size > 0) {
      console.log(`\n📝 Unmatched inspector names (${unmatchedInspectors.size}):`);
      Array.from(unmatchedInspectors).slice(0, 20).forEach(name => {
        console.log(`   - "${name}"`);
      });
      if (unmatchedInspectors.size > 20) {
        console.log(`   ... and ${unmatchedInspectors.size - 20} more`);
      }
    }

    if (unmatchedGames.size > 0) {
      console.log(`\n📝 Unmatched game names (${unmatchedGames.size}):`);
      Array.from(unmatchedGames).slice(0, 20).forEach(name => {
        console.log(`   - "${name}"`);
      });
      if (unmatchedGames.size > 20) {
        console.log(`   ... and ${unmatchedGames.size - 20} more`);
      }
    }

    // Step 6: Verify results
    console.log('\n🔍 Verifying results...');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(inspector_id) as with_inspector,
        COUNT(*) - COUNT(inspector_id) as without_inspector
      FROM content_checks
    `);

    const stats = verifyResult.rows[0];
    console.log(`\n✅ PostgreSQL content_checks table:`);
    console.log(`   Total records: ${stats.total}`);
    console.log(`   With inspector_id: ${stats.with_inspector} (${((stats.with_inspector/stats.total)*100).toFixed(1)}%)`);
    console.log(`   Without inspector_id: ${stats.without_inspector} (${((stats.without_inspector/stats.total)*100).toFixed(1)}%)`);

    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

backfillInspectors().catch(console.error);
