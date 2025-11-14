/**
 * Delete Ivy from staff list
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function deleteIvy() {
  try {
    // Delete Ivy
    const result = await pool.query(`
      DELETE FROM staff_list
      WHERE nickname = 'Ivy'
      RETURNING *
    `);

    if (result.rows.length > 0) {
      console.log('✅ Deleted Ivy from staff list');
      console.log('   Details:', result.rows[0]);
    } else {
      console.log('⚠️  Ivy not found in staff list');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteIvy();
