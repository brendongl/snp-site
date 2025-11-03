/**
 * Check Staff Database for Vikunja Account Creation
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('📋 STAFF MEMBERS - VIKUNJA ACCOUNT PREP');
  console.log('='.repeat(70));
  console.log('');

  const result = await pool.query(`
    SELECT
      id,
      staff_name as name,
      staff_email as email
    FROM staff_list
    ORDER BY staff_name
  `);

  const withEmail = result.rows.filter(s => s.email);
  const withoutEmail = result.rows.filter(s => !s.email);

  console.log('✅ Staff WITH email (can create Vikunja accounts):');
  console.log('');
  withEmail.forEach((staff, i) => {
    console.log(`${i + 1}. ${staff.name}`);
    console.log(`   📧 Email: ${staff.email}`);
    console.log(`   🆔 UUID: ${staff.id}`);
    console.log('');
  });

  if (withoutEmail.length > 0) {
    console.log('⚠️  Staff WITHOUT email (need email before Vikunja account):');
    console.log('');
    withoutEmail.forEach((staff, i) => {
      console.log(`${i + 1}. ${staff.name}`);
      console.log(`   🆔 UUID: ${staff.id}`);
      console.log('');
    });
  }

  console.log('='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total staff: ${result.rows.length}`);
  console.log(`With email: ${withEmail.length} (ready for Vikunja)`);
  console.log(`Without email: ${withoutEmail.length} (need email first)`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Create Vikunja accounts for staff with emails');
  console.log('2. Add them to "Sip n Play" team (ID: 1)');
  console.log('3. Link accounts using email as key');

  await pool.end();
}

main().catch(console.error);
