const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkNicknames() {
  console.log('🔍 Checking staff nicknames in database...\n');

  try {
    const result = await pool.query(`
      SELECT
        id,
        staff_name,
        nickname,
        points
      FROM staff_list
      ORDER BY staff_name
    `);

    console.log(`Found ${result.rows.length} staff members:\n`);

    let populated = 0;
    let missing = 0;

    result.rows.forEach((staff, index) => {
      const hasNickname = staff.nickname ? '✅' : '❌';
      if (staff.nickname) populated++;
      else missing++;

      console.log(`${index + 1}. ${hasNickname} ${staff.staff_name}`);
      console.log(`   Nickname: ${staff.nickname || '(not set)'}`);
      console.log(`   Points: ${staff.points || 0}`);
      console.log('');
    });

    console.log(`Summary: ${populated} with nicknames, ${missing} without\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNicknames();
