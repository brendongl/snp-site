const { Pool } = require('pg');

// STAGING DATABASE
const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

const pool = new Pool({ connectionString: STAGING_DATABASE_URL });

async function addProfileColumns() {
  console.log('🔧 Adding profile columns to STAGING staff_list table...\n');
  console.log('Database: shuttle.proxy.rlwy.net:38585\n');

  try {
    // Add all the new columns
    await pool.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS nickname VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contact_ph VARCHAR(50),
      ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS national_id_hash VARCHAR(64),
      ADD COLUMN IF NOT EXISTS home_address TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS emergency_contact_ph VARCHAR(50),
      ADD COLUMN IF NOT EXISTS date_of_hire DATE,
      ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP;
    `);

    console.log('✅ Successfully added profile columns\n');

    // Verify columns were added
    const result = await pool.query(`
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
    console.error('❌ Error adding columns:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addProfileColumns();
