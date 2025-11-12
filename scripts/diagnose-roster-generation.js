/**
 * Diagnose Roster Generation Issues
 * Understand why only 3 staff were used despite 11 having availability
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function diagnose() {
  try {
    console.log('🔍 ROSTER GENERATION DIAGNOSIS');
    console.log('='.repeat(70));
    console.log('');

    // Check how many staff have keys
    const keysQuery = await pool.query(`
      SELECT
        staff_name,
        has_keys,
        available_roles
      FROM staff_list
      WHERE has_keys = true
      ORDER BY staff_name
    `);

    console.log(`🔑 Staff with keys (${keysQuery.rows.length}):`);
    keysQuery.rows.forEach(s => {
      console.log(`  - ${s.staff_name}`);
      console.log(`    Roles: ${s.available_roles || 'NULL'}`);
    });
    console.log('');

    // Check Monday opening shift availability
    console.log('📅 Monday Opening Shift Availability (9am-2pm):');
    const mondayQuery = await pool.query(`
      SELECT
        sl.staff_name,
        sl.has_keys,
        sa.status,
        sa.hour_start,
        sa.hour_end
      FROM staff_list sl
      JOIN staff_availability sa ON sa.staff_id = sl.id
      WHERE sa.day_of_week = 'Monday'
        AND sa.hour_start <= 9
        AND sa.hour_end >= 14
        AND sa.status IN ('available', 'preferred')
      ORDER BY sl.has_keys DESC NULLS LAST, sl.staff_name
    `);

    console.log(`  Found ${mondayQuery.rows.length} staff available:`);
    mondayQuery.rows.forEach(s => {
      const keysEmoji = s.has_keys ? '🔑' : '❌';
      console.log(`  ${keysEmoji} ${s.staff_name} (${s.status})`);
    });
    console.log('');

    // Check Thursday opening shift availability
    console.log('📅 Thursday Opening Shift Availability (9am-2pm):');
    const thursdayQuery = await pool.query(`
      SELECT
        sl.staff_name,
        sl.has_keys,
        sa.status,
        sa.hour_start,
        sa.hour_end
      FROM staff_list sl
      JOIN staff_availability sa ON sa.staff_id = sl.id
      WHERE sa.day_of_week = 'Thursday'
        AND sa.hour_start <= 9
        AND sa.hour_end >= 14
        AND sa.status IN ('available', 'preferred')
      ORDER BY sl.has_keys DESC NULLS LAST, sl.staff_name
    `);

    console.log(`  Found ${thursdayQuery.rows.length} staff available:`);
    thursdayQuery.rows.forEach(s => {
      const keysEmoji = s.has_keys ? '🔑' : '❌';
      console.log(`  ${keysEmoji} ${s.staff_name} (${s.status})`);
    });
    console.log('');

    // Check Sunday opening shift availability
    console.log('📅 Sunday Opening Shift Availability (9am-2pm):');
    const sundayQuery = await pool.query(`
      SELECT
        sl.staff_name,
        sl.has_keys,
        sa.status,
        sa.hour_start,
        sa.hour_end
      FROM staff_list sl
      JOIN staff_availability sa ON sa.staff_id = sl.id
      WHERE sa.day_of_week = 'Sunday'
        AND sa.hour_start <= 9
        AND sa.hour_end >= 14
        AND sa.status IN ('available', 'preferred')
      ORDER BY sl.has_keys DESC NULLS LAST, sl.staff_name
    `);

    console.log(`  Found ${sundayQuery.rows.length} staff available:`);
    sundayQuery.rows.forEach(s => {
      const keysEmoji = s.has_keys ? '🔑' : '❌';
      console.log(`  ${keysEmoji} ${s.staff_name} (${s.status})`);
    });
    console.log('');

    console.log('💡 FINDINGS:');
    console.log(`  - Only ${keysQuery.rows.length} staff have keys configured`);
    console.log(`  - Opening shifts REQUIRE keys (hard constraint)`);
    console.log(`  - Monday: ${mondayQuery.rows.filter(s => s.has_keys).length} staff with keys available`);
    console.log(`  - Thursday: ${thursdayQuery.rows.filter(s => s.has_keys).length} staff with keys available`);
    console.log(`  - Sunday: ${sundayQuery.rows.filter(s => s.has_keys).length} staff with keys available`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

diagnose();
