const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function addCheckTypeColumn() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('Adding check_type column to content_checks table...');

    // Add column with default value
    await pool.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS check_type VARCHAR(50) DEFAULT 'regular';
    `);

    // Update existing records to have 'regular' type
    await pool.query(`
      UPDATE content_checks
      SET check_type = 'regular'
      WHERE check_type IS NULL;
    `);

    console.log('✅ check_type column added successfully');
    console.log('✅ Existing records updated to "regular" type');
  } catch (error) {
    console.error('❌ Error adding check_type column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

addCheckTypeColumn();
