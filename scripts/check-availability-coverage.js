/**
 * Check Staff Availability Coverage
 * Verifies which staff members have availability data in the system
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAvailabilityCoverage() {
  try {
    const result = await pool.query(`
      SELECT
        sl.staff_name,
        sl.id,
        sl.has_keys,
        sl.available_roles,
        COUNT(sa.id) as availability_slots
      FROM staff_list sl
      LEFT JOIN staff_availability sa ON sa.staff_id = sl.id
      GROUP BY sl.id, sl.staff_name, sl.has_keys, sl.available_roles
      ORDER BY availability_slots DESC, sl.staff_name
    `);

    console.log('👥 STAFF AVAILABILITY COVERAGE');
    console.log('='.repeat(70));
    console.log('');

    const withAvail = [];
    const withoutAvail = [];

    result.rows.forEach(row => {
      if (row.availability_slots > 0) {
        withAvail.push(row);
      } else {
        withoutAvail.push(row);
      }
    });

    console.log(`✅ Staff WITH availability data (${withAvail.length}):`);
    console.log('');
    withAvail.forEach((row, i) => {
      console.log(`${i+1}. ${row.staff_name}`);
      console.log(`   Slots: ${row.availability_slots}`);
      console.log(`   Has Keys: ${row.has_keys || 'NULL'}`);
      console.log(`   Roles: ${row.available_roles || 'NULL'}`);
      console.log('');
    });

    console.log(`❌ Staff WITHOUT availability data (${withoutAvail.length}):`);
    console.log('');
    withoutAvail.forEach((row, i) => {
      console.log(`${i+1}. ${row.staff_name}`);
    });

    console.log('');
    console.log('📊 Total: ' + result.rows.length + ' staff members');
    console.log('📊 With Availability: ' + withAvail.length);
    console.log('📊 Missing Availability: ' + withoutAvail.length);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkAvailabilityCoverage();
