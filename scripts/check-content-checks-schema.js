/**
 * Check content_checks table schema on staging database
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function checkSchema() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n📋 Checking content_checks table schema on STAGING database...\n');
    console.log('Database:', STAGING_DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

    // Get all columns from content_checks table
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'content_checks'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 content_checks table columns:');
    console.log('=====================================');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // Count records
    const countResult = await pool.query('SELECT COUNT(*) as count FROM content_checks');
    console.log(`\n📊 Total content_checks records: ${countResult.rows[0].count}`);

    // Check if inspector_staff_id exists
    const hasInspectorStaffId = columnsResult.rows.some(col => col.column_name === 'inspector_staff_id');

    if (hasInspectorStaffId) {
      console.log('\n✅ inspector_staff_id column EXISTS');
    } else {
      console.log('\n❌ inspector_staff_id column DOES NOT EXIST');
      console.log('   Need to add this column or adjust the query');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkSchema().catch(console.error);
