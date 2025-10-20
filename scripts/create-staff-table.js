const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
});

async function createStaffTable() {
  const client = await pool.connect();
  try {
    console.log('Creating staff_list table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_list (
        staff_id VARCHAR(50) PRIMARY KEY,
        staff_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Table created');

    console.log('Creating index on staff_name...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_name ON staff_list(staff_name);
    `);

    console.log('✓ Index created');

    console.log('Adding table comment...');
    await client.query(`
      COMMENT ON TABLE staff_list IS 'Cache of staff members from Airtable Staff table. Synced daily via POST /api/staff-list/sync';
    `);

    console.log('✓ Table comment added');
    console.log('\n✅ Successfully created staff_list table!');
  } catch (error) {
    console.error('❌ Error creating table:', error);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

createStaffTable();
