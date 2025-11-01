/**
 * Diagnose staff data relationship issues
 * This script checks the JOIN conditions between tables to identify mismatches
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function diagnose() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Diagnosing staff data relationships...\n');

    // 1. Check staff_knowledge JOINs
    console.log('='.repeat(60));
    console.log('1. STAFF_KNOWLEDGE DATA');
    console.log('='.repeat(60));

    const knowledgeCheck = await pool.query(`
      SELECT
        sk.id,
        sk.staff_member_id,
        sk.game_id,
        g.name as game_name,
        sl_by_stafflist.staff_name as staff_name_via_stafflist_id,
        sl_by_staffid.staff_name as staff_name_via_staff_id
      FROM staff_knowledge sk
      LEFT JOIN games g ON sk.game_id = g.id
      LEFT JOIN staff_list sl_by_stafflist ON sk.staff_member_id = sl_by_stafflist.stafflist_id
      LEFT JOIN staff_list sl_by_staffid ON sk.staff_member_id = sl_by_staffid.staff_id
      LIMIT 5
    `);

    console.log('\nSample staff_knowledge records:');
    knowledgeCheck.rows.forEach(row => {
      console.log(`  - Game: ${row.game_name}`);
      console.log(`    staff_member_id: ${row.staff_member_id}`);
      console.log(`    JOIN via stafflist_id: ${row.staff_name_via_stafflist_id || 'NO MATCH'} ✅`);
      console.log(`    JOIN via staff_id: ${row.staff_name_via_staff_id || 'NO MATCH'} ❌`);
      console.log('');
    });

    // 2. Check play_logs JOINs
    console.log('='.repeat(60));
    console.log('2. PLAY_LOGS DATA');
    console.log('='.repeat(60));

    const playLogsCheck = await pool.query(`
      SELECT
        pl.id,
        pl.staff_list_id,
        pl.game_id,
        g.name as game_name,
        sl_by_stafflist.staff_name as staff_name_via_stafflist_id,
        sl_by_staffid.staff_name as staff_name_via_staff_id
      FROM play_logs pl
      LEFT JOIN games g ON pl.game_id = g.id
      LEFT JOIN staff_list sl_by_stafflist ON pl.staff_list_id = sl_by_stafflist.stafflist_id
      LEFT JOIN staff_list sl_by_staffid ON pl.staff_list_id = sl_by_staffid.staff_id
      LIMIT 5
    `);

    if (playLogsCheck.rows.length > 0) {
      console.log('\nSample play_logs records:');
      playLogsCheck.rows.forEach(row => {
        console.log(`  - Game: ${row.game_name}`);
        console.log(`    staff_list_id: ${row.staff_list_id}`);
        console.log(`    JOIN via stafflist_id: ${row.staff_name_via_stafflist_id || 'NO MATCH'} ❌`);
        console.log(`    JOIN via staff_id: ${row.staff_name_via_staff_id || 'NO MATCH'} ✅`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No play_logs records found in database!');
    }

    // 3. Check content_checks JOINs
    console.log('='.repeat(60));
    console.log('3. CONTENT_CHECKS DATA');
    console.log('='.repeat(60));

    const contentChecksCheck = await pool.query(`
      SELECT
        cc.id,
        cc.inspector_id,
        cc.game_id,
        g.name as game_name,
        sl_by_stafflist.staff_name as staff_name_via_stafflist_id,
        sl_by_staffid.staff_name as staff_name_via_staff_id
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl_by_stafflist ON cc.inspector_id = sl_by_stafflist.stafflist_id
      LEFT JOIN staff_list sl_by_staffid ON cc.inspector_id = sl_by_staffid.staff_id
      LIMIT 5
    `);

    console.log('\nSample content_checks records:');
    contentChecksCheck.rows.forEach(row => {
      console.log(`  - Game: ${row.game_name}`);
      console.log(`    inspector_id: ${row.inspector_id}`);
      console.log(`    JOIN via stafflist_id: ${row.staff_name_via_stafflist_id || 'NO MATCH'} ✅`);
      console.log(`    JOIN via staff_id: ${row.staff_name_via_staff_id || 'NO MATCH'} ❌`);
      console.log('');
    });

    // 4. Check for user brendonganle@gmail.com specifically
    console.log('='.repeat(60));
    console.log('4. YOUR ACCOUNT DATA (brendonganle@gmail.com)');
    console.log('='.repeat(60));

    const yourAccount = await pool.query(`
      SELECT
        sl.staff_id,
        sl.stafflist_id,
        sl.staff_name,
        sl.staff_email,
        COUNT(DISTINCT sk.id) as knowledge_count,
        COUNT(DISTINCT pl.id) as play_logs_count,
        COUNT(DISTINCT cc.id) as content_checks_count
      FROM staff_list sl
      LEFT JOIN staff_knowledge sk ON sk.staff_member_id = sl.stafflist_id
      LEFT JOIN play_logs pl ON pl.staff_list_id = sl.staff_id
      LEFT JOIN content_checks cc ON cc.inspector_id = sl.stafflist_id
      WHERE sl.staff_email = 'brendonganle@gmail.com'
      GROUP BY sl.staff_id, sl.stafflist_id, sl.staff_name, sl.staff_email
    `);

    if (yourAccount.rows.length > 0) {
      const account = yourAccount.rows[0];
      console.log(`\n✅ Found: ${account.staff_name}`);
      console.log(`   staff_id: ${account.staff_id}`);
      console.log(`   stafflist_id: ${account.stafflist_id}`);
      console.log(`   Knowledge entries: ${account.knowledge_count}`);
      console.log(`   Play logs: ${account.play_logs_count}`);
      console.log(`   Content checks: ${account.content_checks_count}`);
    } else {
      console.log('\n❌ Not found in database');
    }

    // 5. Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY & REQUIRED FIXES');
    console.log('='.repeat(60));
    console.log('\n✅ CORRECT JOIN conditions:');
    console.log('   - staff_knowledge.staff_member_id → staff_list.stafflist_id');
    console.log('   - content_checks.inspector_id → staff_list.stafflist_id');
    console.log('\n❌ WRONG JOIN condition (needs fixing):');
    console.log('   - play_logs.staff_list_id → should JOIN staff_list.staff_id, NOT stafflist_id!');
    console.log('\n📝 API field name issues:');
    console.log('   - staff-knowledge API returns staffMember=NAME, but component filters by staffId=ID');
    console.log('   - Need to add staff_member_id to API response for proper filtering\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

diagnose().catch(console.error);
