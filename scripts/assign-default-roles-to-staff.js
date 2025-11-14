/**
 * Assign default roles (floor, cafe) to all staff members
 *
 * This ensures all staff can be rostered for any shift type.
 * Staff with keys can still be identified via the has_keys field.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function assignDefaultRoles() {
  try {
    // Get all staff without roles or with incomplete roles
    const result = await pool.query(`
      SELECT id, staff_name, nickname, available_roles
      FROM staff_list
      WHERE available_roles IS NULL
         OR NOT (available_roles @> ARRAY['floor']::text[]
             AND available_roles @> ARRAY['cafe']::text[])
    `);

    console.log(`\n📋 Found ${result.rows.length} staff members needing role assignment:\n`);

    for (const staff of result.rows) {
      const currentRoles = staff.available_roles || [];
      const newRoles = Array.from(new Set([...currentRoles, 'floor', 'cafe']));

      await pool.query(`
        UPDATE staff_list
        SET available_roles = $1
        WHERE id = $2
      `, [newRoles, staff.id]);

      console.log(`✅ ${staff.nickname || staff.staff_name}: ${JSON.stringify(currentRoles)} → ${JSON.stringify(newRoles)}`);
    }

    console.log(`\n✅ Successfully assigned roles to ${result.rows.length} staff members\n`);

    // Verify the update
    const verifyResult = await pool.query(`
      SELECT nickname, available_roles
      FROM staff_list
      WHERE nickname IN ('Long', 'An', 'Vũ', 'Sơn', 'Nhi', 'Ivy')
      ORDER BY nickname
    `);

    console.log('📋 Verification - Constrained staff roles:\n');
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.nickname}: ${JSON.stringify(row.available_roles)}`);
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

assignDefaultRoles();
