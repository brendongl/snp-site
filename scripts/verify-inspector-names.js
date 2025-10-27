/**
 * Verify that inspector names are correctly resolved after backfill
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function verifyInspectorNames() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Verifying inspector name resolution...\n');

    // Query with JOIN (same as content-checks-db-service.ts)
    const result = await pool.query(`
      SELECT
        cc.id,
        cc.game_id,
        cc.check_date,
        cc.inspector_id,
        sl.staff_name as inspector_name,
        g.name as game_name
      FROM content_checks cc
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      LEFT JOIN games g ON cc.game_id = g.id
      WHERE cc.inspector_id IS NOT NULL
      ORDER BY cc.check_date DESC
      LIMIT 20
    `);

    console.log(`✅ Found ${result.rows.length} content checks with inspectors\n`);
    console.log('=' .repeat(80));
    console.log('SAMPLE CONTENT CHECKS WITH INSPECTOR NAMES');
    console.log('='.repeat(80));

    result.rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.game_name}`);
      console.log(`   Check Date: ${new Date(row.check_date).toLocaleDateString()}`);
      console.log(`   Inspector: ${row.inspector_name || '⚠️ NULL (JOIN FAILED)'}`);
      console.log(`   inspector_id: ${row.inspector_id}`);
    });

    // Check for JOIN failures
    const joinFailures = result.rows.filter(row => !row.inspector_name);
    if (joinFailures.length > 0) {
      console.log(`\n⚠️  WARNING: ${joinFailures.length} records have inspector_id but name is NULL`);
      console.log('   This means the inspector_id doesn\'t match any stafflist_id in staff_list table');
    } else {
      console.log(`\n✅ All ${result.rows.length} records have valid inspector names!`);
    }

    // Statistics
    console.log('\n' + '='.repeat(80));
    console.log('OVERALL STATISTICS');
    console.log('='.repeat(80));

    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_checks,
        COUNT(cc.inspector_id) as with_inspector_id,
        COUNT(sl.staff_name) as with_resolved_name,
        COUNT(cc.inspector_id) - COUNT(sl.staff_name) as join_failures
      FROM content_checks cc
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
    `);

    const stats = statsResult.rows[0];
    console.log(`\nTotal content checks: ${stats.total_checks}`);
    console.log(`With inspector_id: ${stats.with_inspector_id} (${((stats.with_inspector_id/stats.total_checks)*100).toFixed(1)}%)`);
    console.log(`With resolved name: ${stats.with_resolved_name} (${((stats.with_resolved_name/stats.total_checks)*100).toFixed(1)}%)`);
    console.log(`JOIN failures: ${stats.join_failures}`);

    if (parseInt(stats.join_failures) > 0) {
      console.log('\n⚠️  Some inspector_id values don\'t match staff_list.stafflist_id');
      console.log('   This needs investigation!');
    } else {
      console.log('\n✅ All inspector_id values correctly resolve to staff names!');
    }

    console.log('\n✨ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyInspectorNames().catch(console.error);
