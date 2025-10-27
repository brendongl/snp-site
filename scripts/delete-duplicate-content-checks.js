const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
  ssl: false
});

async function analyzeDuplicates() {
  console.log('=== Content Check Duplicate Analysis ===\n');

  try {
    // 1. Find all duplicates (same game_id + same check_date)
    console.log('1. Finding duplicate records...');
    const duplicatesQuery = await pool.query(`
      SELECT
        game_id,
        check_date::date as check_date,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at) as record_ids,
        ARRAY_AGG(inspector_id) as inspector_ids,
        ARRAY_AGG(created_at ORDER BY created_at) as created_dates
      FROM content_checks
      GROUP BY game_id, check_date::date
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, game_id, check_date
    `);

    console.log(`Found ${duplicatesQuery.rows.length} sets of duplicate records\n`);

    if (duplicatesQuery.rows.length === 0) {
      console.log('No duplicates found! Database is clean.');
      return;
    }

    // Display duplicates
    console.log('Duplicate sets:');
    console.table(duplicatesQuery.rows.map(row => ({
      game_id: row.game_id,
      check_date: row.check_date,
      count: row.count,
      record_ids: row.record_ids.join(', '),
      has_inspector: row.inspector_ids.some(id => id !== null) ? 'Yes' : 'No'
    })));

    // 2. Analyze deletion candidates
    console.log('\n2. Analyzing deletion candidates...');

    let toDelete = [];
    let toKeep = [];
    let skipBothHaveInspector = [];

    for (const dup of duplicatesQuery.rows) {
      const { game_id, check_date, record_ids, inspector_ids } = dup;

      // Count how many have inspector_id
      const withInspector = inspector_ids.filter(id => id !== null).length;
      const withoutInspector = inspector_ids.filter(id => id === null).length;

      if (withInspector === 0) {
        // All records have NULL inspector - keep first, delete rest
        toKeep.push(record_ids[0]);
        toDelete.push(...record_ids.slice(1));
      } else if (withInspector === inspector_ids.length) {
        // All records have inspector_id - SKIP (don't delete)
        console.log(`⚠️  Skipping game ${game_id} on ${check_date} - all ${inspector_ids.length} records have inspector_id`);
        skipBothHaveInspector.push(...record_ids);
      } else {
        // Mixed: some have inspector, some don't
        // Keep the one WITH inspector, delete the ones WITHOUT
        for (let i = 0; i < record_ids.length; i++) {
          if (inspector_ids[i] !== null) {
            toKeep.push(record_ids[i]);
          } else {
            toDelete.push(record_ids[i]);
          }
        }
      }
    }

    console.log(`\nDeletion plan:`);
    console.log(`  - Records to KEEP: ${toKeep.length}`);
    console.log(`  - Records to DELETE: ${toDelete.length}`);
    console.log(`  - Records to SKIP (both have inspector): ${skipBothHaveInspector.length}`);

    if (toDelete.length === 0) {
      console.log('\nNo records to delete!');
      return;
    }

    // 3. Show detailed deletion list
    console.log('\n3. Records to be DELETED:');
    const deleteDetails = await pool.query(`
      SELECT
        cc.id,
        g.name as game_name,
        cc.check_date,
        cc.inspector_id,
        sl.staff_name,
        cc.status,
        cc.created_at
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      WHERE cc.id = ANY($1)
      ORDER BY cc.game_id, cc.check_date
    `, [toDelete]);

    console.table(deleteDetails.rows.map(row => ({
      id: row.id,
      game_name: row.game_name,
      check_date: row.check_date,
      inspector_id: row.inspector_id || 'NULL',
      staff_name: row.staff_name || 'Unknown',
      status: row.status,
      created_at: row.created_at
    })));

    // 4. Show records that will be KEPT
    console.log('\n4. Records to be KEPT:');
    const keepDetails = await pool.query(`
      SELECT
        cc.id,
        g.name as game_name,
        cc.check_date,
        cc.inspector_id,
        sl.staff_name,
        cc.status,
        cc.created_at
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      WHERE cc.id = ANY($1)
      ORDER BY cc.game_id, cc.check_date
    `, [toKeep]);

    console.table(keepDetails.rows.map(row => ({
      id: row.id,
      game_name: row.game_name,
      check_date: row.check_date,
      inspector_id: row.inspector_id || 'NULL',
      staff_name: row.staff_name || 'Unknown',
      status: row.status,
      created_at: row.created_at
    })));

    return { toDelete, toKeep, skipBothHaveInspector };

  } catch (error) {
    console.error('Error analyzing duplicates:', error);
    throw error;
  }
}

async function deleteDuplicates() {
  console.log('\n\n=== DELETING DUPLICATE RECORDS ===\n');

  try {
    // First analyze
    const analysis = await analyzeDuplicates();

    if (!analysis || analysis.toDelete.length === 0) {
      console.log('No duplicates to delete.');
      await pool.end();
      return;
    }

    const { toDelete } = analysis;

    console.log(`\n⚠️  WARNING: About to delete ${toDelete.length} records!`);
    console.log('Starting deletion in 3 seconds...\n');

    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Perform deletion in a transaction
    console.log('Starting transaction...');
    await pool.query('BEGIN');

    try {
      const deleteResult = await pool.query(`
        DELETE FROM content_checks
        WHERE id = ANY($1)
        RETURNING id, game_id, check_date, inspector_id
      `, [toDelete]);

      console.log(`✓ Deleted ${deleteResult.rowCount} records`);

      // Verify final state
      const finalCount = await pool.query(`
        SELECT COUNT(*) as total_checks,
               COUNT(DISTINCT (game_id, check_date::date)) as unique_game_dates
        FROM content_checks
      `);

      console.log('\nFinal database state:');
      console.log(`  Total content checks: ${finalCount.rows[0].total_checks}`);
      console.log(`  Unique game+date combinations: ${finalCount.rows[0].unique_game_dates}`);

      // Check for remaining duplicates
      const remainingDups = await pool.query(`
        SELECT COUNT(*) as dup_count
        FROM (
          SELECT game_id, check_date::date
          FROM content_checks
          GROUP BY game_id, check_date::date
          HAVING COUNT(*) > 1
        ) dups
      `);

      console.log(`  Remaining duplicate sets: ${remainingDups.rows[0].dup_count}`);

      await pool.query('COMMIT');
      console.log('\n✓ Transaction committed successfully!');

    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('✗ Error during deletion, transaction rolled back:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error in deletion process:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('=== DRY RUN MODE - NO CHANGES WILL BE MADE ===\n');
  analyzeDuplicates().then(() => {
    pool.end();
  }).catch(err => {
    console.error('Error:', err);
    pool.end();
    process.exit(1);
  });
} else {
  console.log('=== LIVE MODE - CHANGES WILL BE MADE ===\n');
  deleteDuplicates().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
