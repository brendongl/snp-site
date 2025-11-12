/**
 * Update Staff Keys Configuration
 * Mark which staff members have store keys
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Staff with keys (provided by user)
const STAFF_WITH_KEYS = [
  'Nguyễn Minh Hiếu ',  // Hieu
  'Nguyen Thanh Phong (Chase)',  // Phong
  'Nguyễn Phước Thọ ',  // Tho
  'Lê Minh Huy',  // Huy
];

async function updateKeys() {
  const client = await pool.connect();

  try {
    console.log('🔑 Updating staff keys configuration...\n');

    // First, set all staff to has_keys = false (except those already true)
    await client.query(`
      UPDATE staff_list
      SET has_keys = false
      WHERE has_keys IS NULL
    `);

    // Now set has_keys = true for the 4 staff with keys
    for (const staffName of STAFF_WITH_KEYS) {
      const result = await client.query(`
        UPDATE staff_list
        SET has_keys = true
        WHERE staff_name = $1
        RETURNING staff_name, has_keys
      `, [staffName]);

      if (result.rows.length > 0) {
        console.log(`✅ ${staffName} - has_keys = true`);
      } else {
        console.log(`⚠️  ${staffName} - NOT FOUND in database`);
      }
    }

    console.log('\n📊 Keys configuration updated!');

    // Show summary
    const summary = await client.query(`
      SELECT
        staff_name,
        has_keys
      FROM staff_list
      ORDER BY has_keys DESC NULLS LAST, staff_name
    `);

    console.log('\n🔑 Staff Keys Summary:');
    console.log('');
    const withKeys = summary.rows.filter(s => s.has_keys === true);
    const withoutKeys = summary.rows.filter(s => s.has_keys === false || s.has_keys === null);

    console.log(`✅ With Keys (${withKeys.length}):`);
    withKeys.forEach(s => console.log(`   - ${s.staff_name}`));

    console.log('');
    console.log(`❌ Without Keys (${withoutKeys.length}):`);
    withoutKeys.forEach(s => console.log(`   - ${s.staff_name}`));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

updateKeys();
