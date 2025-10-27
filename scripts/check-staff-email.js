const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkStaffEmail() {
  console.log('🔍 Checking staff emails in database...\n');

  try {
    const result = await pool.query(`
      SELECT
        staff_id,
        staff_name,
        staff_email,
        staff_type,
        contact_ph,
        national_id_hash
      FROM staff_list
      ORDER BY staff_name
    `);

    console.log(`Found ${result.rows.length} staff members:\n`);

    result.rows.forEach((staff, index) => {
      console.log(`${index + 1}. ${staff.staff_name}`);
      console.log(`   Email: ${staff.staff_email}`);
      console.log(`   Type: ${staff.staff_type}`);
      console.log(`   Has Profile Data: ${staff.contact_ph ? 'Yes' : 'No'}`);
      console.log(`   Has National ID: ${staff.national_id_hash ? 'Yes' : 'No'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStaffEmail();
