const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

const pool = new Pool({ connectionString: STAGING_DATABASE_URL });

async function verifySchema() {
  console.log('🔍 Checking staging database schema...\n');
  console.log('Database: shuttle.proxy.rlwy.net:38585\n');

  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'staff_list'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ staff_list table does not exist!');
      return;
    }

    console.log('✅ staff_list table exists\n');

    // Get all columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'staff_list'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current columns in staff_list:\n');
    columnsResult.rows.forEach(col => {
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      console.log(`   - ${col.column_name}: ${col.data_type}${length}`);
    });

    console.log('\n🔍 Checking for profile columns...\n');

    const requiredColumns = [
      'nickname',
      'contact_ph',
      'bank_account_number',
      'bank_name',
      'national_id_hash',
      'home_address',
      'emergency_contact_name',
      'emergency_contact_ph',
      'date_of_hire',
      'profile_updated_at'
    ];

    const existingColumns = columnsResult.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('❌ Missing profile columns:');
      missingColumns.forEach(col => console.log(`   - ${col}`));
    } else {
      console.log('✅ All profile columns exist!');
    }

    // Count records
    const countResult = await pool.query('SELECT COUNT(*) FROM staff_list');
    console.log(`\n📊 Total staff records: ${countResult.rows[0].count}`);

    // Check how many have profile data
    const profileDataResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE nickname IS NOT NULL) as with_nickname,
        COUNT(*) FILTER (WHERE contact_ph IS NOT NULL) as with_contact,
        COUNT(*) FILTER (WHERE bank_account_number IS NOT NULL) as with_bank,
        COUNT(*) FILTER (WHERE national_id_hash IS NOT NULL) as with_national_id,
        COUNT(*) FILTER (WHERE profile_updated_at IS NOT NULL) as with_profile_update
      FROM staff_list
    `);

    if (missingColumns.length === 0) {
      console.log('\n📊 Profile data population:');
      console.log(`   - With nickname: ${profileDataResult.rows[0].with_nickname}`);
      console.log(`   - With contact phone: ${profileDataResult.rows[0].with_contact}`);
      console.log(`   - With bank account: ${profileDataResult.rows[0].with_bank}`);
      console.log(`   - With National ID: ${profileDataResult.rows[0].with_national_id}`);
      console.log(`   - With profile update: ${profileDataResult.rows[0].with_profile_update}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

verifySchema();
