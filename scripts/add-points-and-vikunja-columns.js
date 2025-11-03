/**
 * Add Points Tracking and Vikunja Integration Columns
 *
 * Adds:
 * - points (integer, default 0) - Track staff points from completed tasks
 * - vikunja_user_id (integer, nullable) - Link to Vikunja user account
 * - vikunja_username (text, nullable) - Vikunja username for easy lookup
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('🔧 ADDING POINTS AND VIKUNJA COLUMNS TO staff_list');
  console.log('='.repeat(70));
  console.log('');

  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // 1. Add points column
    console.log('1️⃣ Adding "points" column...');
    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0 NOT NULL
    `);
    console.log('   ✅ Added points column (default: 0)');

    // 2. Add vikunja_user_id column
    console.log('\n2️⃣ Adding "vikunja_user_id" column...');
    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS vikunja_user_id INTEGER
    `);
    console.log('   ✅ Added vikunja_user_id column (nullable)');

    // 3. Add vikunja_username column
    console.log('\n3️⃣ Adding "vikunja_username" column...');
    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS vikunja_username TEXT
    `);
    console.log('   ✅ Added vikunja_username column (nullable)');

    // 4. Create index on vikunja_user_id for faster lookups
    console.log('\n4️⃣ Creating index on vikunja_user_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_vikunja_user_id
      ON staff_list(vikunja_user_id)
    `);
    console.log('   ✅ Created index for faster lookups');

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS - All columns added!');
    console.log('='.repeat(70));
    console.log('');
    console.log('Next steps:');
    console.log('1. Create Vikunja user accounts for all staff');
    console.log('2. Update staff_list with vikunja_user_id after account creation');
    console.log('3. Implement points tracking when tasks are completed');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
