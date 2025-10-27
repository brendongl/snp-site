/**
 * Remove redundant staff_list_id column from content_checks table
 *
 * The content_checks table has both inspector_id and staff_list_id columns.
 * Only inspector_id is used in the codebase. staff_list_id is always NULL.
 *
 * This script:
 * 1. Verifies staff_list_id is always NULL
 * 2. Drops the column from content_checks table
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function removeRedundantColumn() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Removing redundant staff_list_id column from content_checks table...\n');

    // Step 1: Verify staff_list_id is always NULL
    console.log('📋 Step 1: Verifying staff_list_id is always NULL...');
    const checkResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(staff_list_id) as with_staff_list_id
      FROM content_checks
    `);

    const stats = checkResult.rows[0];
    console.log(`   Total records: ${stats.total}`);
    console.log(`   With staff_list_id: ${stats.with_staff_list_id}`);

    if (parseInt(stats.with_staff_list_id) > 0) {
      console.log('\n⚠️  WARNING: staff_list_id is NOT always NULL!');
      console.log('   Found records with values. Manual review required.');
      console.log('   Aborting migration.\n');
      await pool.end();
      return;
    }

    console.log('   ✅ Confirmed: staff_list_id is NULL in all records\n');

    // Step 2: Verify inspector_id is being used
    console.log('📋 Step 2: Verifying inspector_id usage...');
    const inspectorResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(inspector_id) as with_inspector_id
      FROM content_checks
    `);

    const inspectorStats = inspectorResult.rows[0];
    console.log(`   Total records: ${inspectorStats.total}`);
    console.log(`   With inspector_id: ${inspectorStats.with_inspector_id} (${((inspectorStats.with_inspector_id/inspectorStats.total)*100).toFixed(1)}%)`);
    console.log('   ✅ inspector_id is the active column\n');

    // Step 3: Drop the column
    console.log('📋 Step 3: Dropping staff_list_id column...');
    await pool.query(`
      ALTER TABLE content_checks DROP COLUMN IF EXISTS staff_list_id
    `);
    console.log('   ✅ Column dropped successfully\n');

    // Step 4: Verify column is gone
    console.log('📋 Step 4: Verifying column removal...');
    const verifyResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'content_checks' AND column_name = 'staff_list_id'
    `);

    if (verifyResult.rows.length === 0) {
      console.log('   ✅ Confirmed: staff_list_id column removed\n');
    } else {
      console.log('   ❌ ERROR: Column still exists!\n');
    }

    // Step 5: Show final schema
    console.log('📋 Step 5: Final content_checks schema:');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'content_checks'
      ORDER BY ordinal_position
    `);

    schemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

removeRedundantColumn().catch(console.error);
