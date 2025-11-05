/**
 * Add Nickname Column to Staff List
 *
 * Adds:
 * - nickname (text, nullable) - Optional staff nickname for display
 *
 * Usage: node scripts/add-nickname-column.js
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('🔧 ADDING NICKNAME COLUMN TO staff_list');
  console.log('='.repeat(70));
  console.log('');

  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // 1. Check current schema
    console.log('1️⃣ Checking current staff_list schema...');
    const schemaCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff_list'
      ORDER BY ordinal_position
    `);
    console.log(`   ℹ️  Current columns: ${schemaCheck.rows.map(r => r.column_name).join(', ')}`);

    // 2. Add nickname column
    console.log('\n2️⃣ Adding "nickname" column...');
    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS nickname TEXT
    `);
    console.log('   ✅ Added nickname column (nullable)');

    // 3. Verify column was added
    console.log('\n3️⃣ Verifying column was added...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff_list' AND column_name = 'nickname'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('   ✅ Nickname column verified:');
      console.log(`      - Type: ${verifyResult.rows[0].data_type}`);
      console.log(`      - Nullable: ${verifyResult.rows[0].is_nullable}`);
    } else {
      throw new Error('Nickname column was not created');
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n' + '='.repeat(70));
    console.log('✅ SUCCESS - Nickname column added!');
    console.log('='.repeat(70));
    console.log('');
    console.log('Next steps:');
    console.log('1. Update types/index.ts to add nickname field to StaffMember interface');
    console.log('2. Update staff-db-service.ts to include nickname in queries');
    console.log('3. Update ProfileForm component to allow nickname editing');
    console.log('4. Update staff display components to show nickname');

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
