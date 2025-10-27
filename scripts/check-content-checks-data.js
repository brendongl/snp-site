/**
 * Check which column in content_checks has actual data
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function checkData() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Checking content_checks data columns...\n');

    // Check counts
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(inspector_id) as inspector_id_count,
        COUNT(staff_list_id) as staff_list_id_count
      FROM content_checks
    `);

    const counts = countResult.rows[0];
    console.log('📊 Data counts:');
    console.log(`   Total records: ${counts.total_records}`);
    console.log(`   inspector_id NOT NULL: ${counts.inspector_id_count}`);
    console.log(`   staff_list_id NOT NULL: ${counts.staff_list_id_count}`);

    // Sample data
    console.log('\n📋 Sample records:');
    const sampleResult = await pool.query(`
      SELECT
        id,
        game_id,
        inspector_id,
        staff_list_id,
        check_date
      FROM content_checks
      ORDER BY check_date DESC
      LIMIT 5
    `);

    sampleResult.rows.forEach(row => {
      console.log(`  - Game ID: ${row.game_id}`);
      console.log(`    inspector_id: ${row.inspector_id || 'NULL'}`);
      console.log(`    staff_list_id: ${row.staff_list_id || 'NULL'}`);
      console.log(`    check_date: ${row.check_date}`);
      console.log('');
    });

    // Check which column should join with staff_list
    if (counts.inspector_id_count > 0) {
      console.log('\n✅ inspector_id has data, checking JOIN with staff_list:');
      const joinTest = await pool.query(`
        SELECT
          cc.inspector_id,
          sl_by_stafflist.staff_name as via_stafflist_id,
          sl_by_staffid.staff_name as via_staff_id
        FROM content_checks cc
        LEFT JOIN staff_list sl_by_stafflist ON cc.inspector_id = sl_by_stafflist.stafflist_id
        LEFT JOIN staff_list sl_by_staffid ON cc.inspector_id = sl_by_staffid.staff_id
        WHERE cc.inspector_id IS NOT NULL
        LIMIT 5
      `);

      joinTest.rows.forEach(row => {
        console.log(`  inspector_id: ${row.inspector_id}`);
        console.log(`    JOIN via stafflist_id: ${row.via_stafflist_id || 'NO MATCH'}`);
        console.log(`    JOIN via staff_id: ${row.via_staff_id || 'NO MATCH'}`);
        console.log('');
      });
    }

    if (counts.staff_list_id_count > 0) {
      console.log('\n✅ staff_list_id has data, checking JOIN with staff_list:');
      const joinTest = await pool.query(`
        SELECT
          cc.staff_list_id,
          sl_by_stafflist.staff_name as via_stafflist_id,
          sl_by_staffid.staff_name as via_staff_id
        FROM content_checks cc
        LEFT JOIN staff_list sl_by_stafflist ON cc.staff_list_id = sl_by_stafflist.stafflist_id
        LEFT JOIN staff_list sl_by_staffid ON cc.staff_list_id = sl_by_staffid.staff_id
        WHERE cc.staff_list_id IS NOT NULL
        LIMIT 5
      `);

      joinTest.rows.forEach(row => {
        console.log(`  staff_list_id: ${row.staff_list_id}`);
        console.log(`    JOIN via stafflist_id: ${row.via_stafflist_id || 'NO MATCH'}`);
        console.log(`    JOIN via staff_id: ${row.via_staff_id || 'NO MATCH'}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkData().catch(console.error);
