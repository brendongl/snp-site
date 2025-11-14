/**
 * Check roles for constrained staff
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkStaffRoles() {
  try {
    const result = await pool.query(`
      SELECT nickname, available_roles, has_keys
      FROM staff_list
      WHERE nickname IN ('Long', 'An', 'Vũ', 'Sơn', 'Nhi', 'Ivy')
      ORDER BY nickname
    `);

    console.log('\n📋 Roles and keys for constrained staff:\n');
    result.rows.forEach(row => {
      console.log(`${row.nickname}:`);
      console.log(`  Roles: ${row.available_roles ? JSON.stringify(row.available_roles) : 'NO ROLES ASSIGNED'}`);
      console.log(`  Has keys: ${row.has_keys || false}\n`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStaffRoles();
