/**
 * Migration: Add is_recurring column to roster_holidays
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function addIsRecurringColumn() {
  try {
    console.log('🚀 Adding is_recurring column to roster_holidays...');

    await pool.query(`
      ALTER TABLE roster_holidays
      ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false
    `);

    console.log('✅ Successfully added is_recurring column');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

addIsRecurringColumn();
