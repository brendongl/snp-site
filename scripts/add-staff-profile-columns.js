const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addStaffProfileColumns() {
  const client = await pool.connect();

  try {
    console.log('🔧 Adding profile columns to staff_list table...\n');

    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS nickname VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contact_ph VARCHAR(50),
      ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS national_id_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS home_address TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS emergency_contact_ph VARCHAR(50),
      ADD COLUMN IF NOT EXISTS date_of_hire DATE,
      ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    console.log('✅ Successfully added profile columns\n');

    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'staff_list'
      AND column_name IN (
        'nickname', 'contact_ph', 'bank_account_number', 'bank_name',
        'national_id_hash', 'home_address', 'emergency_contact_name',
        'emergency_contact_ph', 'date_of_hire', 'profile_updated_at'
      )
      ORDER BY column_name;
    `);

    console.log('📋 Added columns:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addStaffProfileColumns().catch(console.error);
