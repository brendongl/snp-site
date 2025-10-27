const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
  ssl: false
});

async function verifyInspectorData() {
  console.log('=== Content Check Inspector Data Verification ===\n');

  try {
    // 1. Check overall inspector_id population
    console.log('1. Overall Inspector ID Population:');
    const overallResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(inspector_id) as with_inspector,
        COUNT(*) - COUNT(inspector_id) as without_inspector
      FROM content_checks
    `);
    console.log(overallResult.rows[0]);
    console.log('');

    // 2. Verify JOIN works (should have 0 failures)
    console.log('2. JOIN Verification:');
    const joinResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE cc.inspector_id IS NOT NULL) as total_with_inspector,
        COUNT(sl.stafflist_id) as successful_joins,
        COUNT(*) FILTER (WHERE cc.inspector_id IS NOT NULL AND sl.stafflist_id IS NULL) as failed_joins
      FROM content_checks cc
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
    `);
    console.log(joinResult.rows[0]);
    console.log('');

    // 3. Show recent checks with inspector names
    console.log('3. Recent Checks (Oct 2025) with Inspector Names:');
    const recentChecks = await pool.query(`
      SELECT
        cc.check_date,
        g.name as game_name,
        cc.inspector_id,
        sl.staff_name as inspector_name
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      WHERE cc.check_date >= '2025-10-01'
      ORDER BY cc.check_date DESC
      LIMIT 20
    `);
    console.table(recentChecks.rows);
    console.log('');

    // 4. Content check counts per staff member
    console.log('4. Content Check Counts by Staff Member:');
    const staffCounts = await pool.query(`
      SELECT
        sl.staff_name,
        sl.stafflist_id,
        COUNT(cc.id) as check_count
      FROM staff_list sl
      LEFT JOIN content_checks cc ON sl.stafflist_id = cc.inspector_id
      GROUP BY sl.staff_name, sl.stafflist_id
      HAVING COUNT(cc.id) > 0
      ORDER BY check_count DESC
    `);
    console.table(staffCounts.rows);
    console.log('');

    // 5. Check specific staff members shown in directory
    console.log('5. Verification of Staff Directory Displayed Counts:');
    const specificStaff = await pool.query(`
      SELECT
        sl.staff_name,
        COUNT(cc.id) as actual_check_count
      FROM staff_list sl
      LEFT JOIN content_checks cc ON sl.stafflist_id = cc.inspector_id
      WHERE sl.staff_name IN (
        'Brendon Gan-Le',
        'Chu Đức Hoàng Phong',
        'Đặng Nhật Minh',
        'Hoang Quang Phi Long',
        'Nguyễn Minh Hiếu',
        'Nguyen Ngoc Bao Nhi',
        'Nguyễn Phước Thọ',
        'Nguyễn Thế Sơn'
      )
      GROUP BY sl.staff_name
      ORDER BY actual_check_count DESC
    `);
    console.log('\nExpected vs Actual (from UI):');
    console.log('Brendon Gan-Le: UI shows 9 checks');
    console.log('Chu Đức Hoàng Phong: UI shows 19 checks');
    console.log('Đặng Nhật Minh: UI shows 1 checks');
    console.log('Hoang Quang Phi Long: UI shows 2 checks');
    console.log('Nguyễn Minh Hiếu: UI shows 18 checks');
    console.log('Nguyen Ngoc Bao Nhi: UI shows 25 checks');
    console.log('Nguyễn Phước Thọ: UI shows 26 checks');
    console.log('Nguyễn Thế Sơn: UI shows 4 checks');
    console.log('\nActual from database:');
    console.table(specificStaff.rows);

    // 6. Check the first few records from content check history page
    console.log('\n6. First 10 Records from Content Check History (Most Recent):');
    const historyRecords = await pool.query(`
      SELECT
        g.name as game_name,
        cc.check_date,
        cc.inspector_id,
        sl.staff_name as inspector_name,
        cc.status
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      ORDER BY cc.check_date DESC
      LIMIT 10
    `);
    console.table(historyRecords.rows);

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await pool.end();
  }
}

verifyInspectorData();
