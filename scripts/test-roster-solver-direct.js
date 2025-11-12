const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testRosterSolver() {
  try {
    console.log('🧪 Testing roster solver directly...\n');

    // Step 1: Get staff with rostering info
    console.log('📊 Step 1: Fetching staff members...');
    const staffResult = await pool.query(`
      SELECT
        id,
        staff_name,
        base_hourly_rate,
        has_keys,
        available_roles
      FROM staff_list
      WHERE base_hourly_rate IS NOT NULL
      ORDER BY staff_name
    `);

    console.log(`   Found ${staffResult.rowCount} staff members with rostering info`);
    staffResult.rows.forEach(s => {
      console.log(`   - ${s.staff_name}: ${s.base_hourly_rate} VND/hr`);
    });

    if (staffResult.rows.length === 0) {
      console.log('❌ No staff found!');
      process.exit(1);
    }

    // Step 2: Import the availability service
    console.log('\n📅 Step 2: Checking availability service...');

    // Try to import the service
    try {
      // Use dynamic import for ES modules
      const RosterDbService = require('../lib/services/roster-db-service.ts').default;
      console.log('   ✅ RosterDbService loaded');

      // Test getting availability for first staff member
      const testStaffId = staffResult.rows[0].id;
      console.log(`   Testing availability for ${staffResult.rows[0].staff_name}...`);

      const availability = await RosterDbService.getAvailabilityByStaffId(testStaffId);
      console.log(`   Found ${availability.length} availability slots`);

    } catch (importError) {
      console.log(`   ⚠️  Import error: ${importError.message}`);
      console.log('   This might be expected - TypeScript files need compilation');
    }

    await pool.end();

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

testRosterSolver();
