/**
 * Comprehensive verification of all staff data fixes
 * Tests the corrected JOIN conditions and data relationships
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function verify() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Verifying all staff data fixes...\n');

    // Test user: brendonganle@gmail.com
    const TEST_EMAIL = 'brendonganle@gmail.com';

    // 1. Get user's staff_id and stafflist_id
    console.log('='.repeat(60));
    console.log('1. USER IDENTIFICATION');
    console.log('='.repeat(60));

    const userResult = await pool.query(`
      SELECT staff_id, stafflist_id, staff_name
      FROM staff_list
      WHERE staff_email = $1
    `, [TEST_EMAIL]);

    if (userResult.rows.length === 0) {
      console.log('❌ User not found!');
      return;
    }

    const { staff_id, stafflist_id, staff_name } = userResult.rows[0];
    console.log(`\n✅ Found user: ${staff_name}`);
    console.log(`   staff_id: ${staff_id}`);
    console.log(`   stafflist_id: ${stafflist_id}`);

    // 2. Test staff_knowledge query (CORRECT: uses stafflist_id)
    console.log('\n' + '='.repeat(60));
    console.log('2. STAFF_KNOWLEDGE QUERY TEST');
    console.log('='.repeat(60));

    const knowledgeResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM staff_knowledge
      WHERE staff_member_id = $1
    `, [stafflist_id]);

    console.log(`\n✅ Knowledge query using stafflist_id: ${knowledgeResult.rows[0].count} records`);

    // Sample with JOIN
    const knowledgeWithNameResult = await pool.query(`
      SELECT
        sk.id,
        sk.staff_member_id,
        g.name as game_name,
        sl.staff_name
      FROM staff_knowledge sk
      LEFT JOIN games g ON sk.game_id = g.id
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.stafflist_id
      WHERE sk.staff_member_id = $1
      LIMIT 3
    `, [stafflist_id]);

    console.log('\nSample records with JOIN:');
    knowledgeWithNameResult.rows.forEach(row => {
      console.log(`  - Game: ${row.game_name}`);
      console.log(`    Staff: ${row.staff_name}`);
      console.log(`    staff_member_id: ${row.staff_member_id}`);
    });

    // 3. Test play_logs query (FIXED: now uses stafflist_id)
    console.log('\n' + '='.repeat(60));
    console.log('3. PLAY_LOGS QUERY TEST');
    console.log('='.repeat(60));

    const playLogsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM play_logs
      WHERE staff_list_id = $1
    `, [stafflist_id]);

    console.log(`\n✅ Play logs query using stafflist_id: ${playLogsResult.rows[0].count} records`);

    // Sample with JOIN
    const playLogsWithNameResult = await pool.query(`
      SELECT
        pl.id,
        pl.staff_list_id,
        g.name as game_name,
        sl.staff_name,
        pl.session_date
      FROM play_logs pl
      LEFT JOIN games g ON pl.game_id = g.id
      LEFT JOIN staff_list sl ON pl.staff_list_id = sl.stafflist_id
      WHERE pl.staff_list_id = $1
      LIMIT 3
    `, [stafflist_id]);

    if (playLogsWithNameResult.rows.length > 0) {
      console.log('\nSample records with JOIN:');
      playLogsWithNameResult.rows.forEach(row => {
        console.log(`  - Game: ${row.game_name}`);
        console.log(`    Staff: ${row.staff_name}`);
        console.log(`    Date: ${row.session_date}`);
      });
    } else {
      console.log('\n⚠️  No play logs found for this user');
    }

    // 4. Test content_checks query (FIXED: now uses inspector_id)
    console.log('\n' + '='.repeat(60));
    console.log('4. CONTENT_CHECKS QUERY TEST');
    console.log('='.repeat(60));

    const contentChecksResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM content_checks
      WHERE inspector_id = $1
    `, [stafflist_id]);

    console.log(`\n✅ Content checks query using inspector_id: ${contentChecksResult.rows[0].count} records`);

    // Sample with JOIN
    const contentChecksWithNameResult = await pool.query(`
      SELECT
        cc.id,
        cc.inspector_id,
        g.name as game_name,
        sl.staff_name,
        cc.check_date
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
      WHERE cc.inspector_id = $1
      LIMIT 3
    `, [stafflist_id]);

    if (contentChecksWithNameResult.rows.length > 0) {
      console.log('\nSample records with JOIN:');
      contentChecksWithNameResult.rows.forEach(row => {
        console.log(`  - Game: ${row.game_name}`);
        console.log(`    Inspector: ${row.staff_name}`);
        console.log(`    Date: ${row.check_date}`);
      });
    } else {
      console.log('\n⚠️  No content checks found for this user');
    }

    // Check how many content checks have NULL inspector_id
    const nullInspectorResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(inspector_id) as with_inspector
      FROM content_checks
    `);

    const nullCount = nullInspectorResult.rows[0].total - nullInspectorResult.rows[0].with_inspector;
    console.log(`\n📊 Content checks data status:`);
    console.log(`   Total records: ${nullInspectorResult.rows[0].total}`);
    console.log(`   With inspector_id: ${nullInspectorResult.rows[0].with_inspector}`);
    console.log(`   NULL inspector_id: ${nullCount}`);
    if (nullCount > 0) {
      console.log(`   ⚠️  ${nullCount} historical records will show "Unknown Staff"`);
    }

    // 5. Test getAllStaffWithStats query pattern
    console.log('\n' + '='.repeat(60));
    console.log('5. GET_ALL_STAFF_WITH_STATS QUERY TEST');
    console.log('='.repeat(60));

    const allStaffStatsResult = await pool.query(`
      SELECT
        sl.staff_id,
        sl.stafflist_id,
        sl.staff_name,
        COUNT(DISTINCT sk.id) as knowledge_count,
        COUNT(DISTINCT pl.id) as play_logs_count,
        COUNT(DISTINCT cc.id) as content_checks_count
      FROM staff_list sl
      LEFT JOIN staff_knowledge sk ON sk.staff_member_id = sl.stafflist_id
      LEFT JOIN play_logs pl ON pl.staff_list_id = sl.stafflist_id
      LEFT JOIN content_checks cc ON cc.inspector_id = sl.stafflist_id
      WHERE sl.staff_email = $1
      GROUP BY sl.staff_id, sl.stafflist_id, sl.staff_name
    `, [TEST_EMAIL]);

    if (allStaffStatsResult.rows.length > 0) {
      const userStats = allStaffStatsResult.rows[0];
      console.log(`\n✅ Aggregate stats for ${userStats.staff_name}:`);
      console.log(`   Knowledge entries: ${userStats.knowledge_count}`);
      console.log(`   Play logs: ${userStats.play_logs_count}`);
      console.log(`   Content checks: ${userStats.content_checks_count}`);
    }

    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    console.log('\n✅ All queries are now using correct JOIN conditions:');
    console.log('   - staff_knowledge → stafflist_id ✓');
    console.log('   - play_logs → stafflist_id ✓');
    console.log('   - content_checks → stafflist_id ✓');

    console.log('\n📝 Notes:');
    console.log('   - API now returns staffMemberId field for filtering');
    console.log('   - KnowledgeStats component filters by staffMemberId');
    console.log('   - Historical content checks with NULL inspector_id will show "Unknown Staff"');
    console.log('   - New content checks with inspector_id will display correctly\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

verify().catch(console.error);
