const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkSchemas() {
  try {
    // Check staff_list columns
    const staffList = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'staff_list'
      ORDER BY ordinal_position
    `);

    console.log('📋 staff_list columns:');
    staffList.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Check rostering_staff_info columns
    const rosteringInfo = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'rostering_staff_info'
      ORDER BY ordinal_position
    `);

    console.log('\n🗓️  rostering_staff_info columns:');
    rosteringInfo.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSchemas();
