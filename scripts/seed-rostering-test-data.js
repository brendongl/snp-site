/**
 * Script: Seed Rostering Test Data
 * Purpose: Create comprehensive test data for Phase 1 rostering system
 *
 * What this script does:
 * 1. Update existing staff members with rostering fields
 * 2. Create sample availability patterns for 5 staff members
 * 3. Create test roster shifts for the current week (starting Monday)
 * 4. Create test clock-in records for verification
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Helper: Get next Monday from today
function getNextMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Helper: Get current week's Monday
function getCurrentMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  return monday.toISOString().split('T')[0];
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting rostering test data seed...\n');

    // Step 1: Update staff members with rostering fields
    console.log('📝 Step 1: Updating staff members with rostering fields...');

    // Step 2: Get first 3 staff members and update with rostering fields
    console.log('\n📝 Step 2: Fetching first 3 staff members...');
    const staffResult = await client.query(
      `SELECT id, staff_name, staff_email FROM staff_list
       ORDER BY staff_name
       LIMIT 3`
    );

    if (staffResult.rows.length === 0) {
      console.error('❌ No staff members found. Please ensure staff exist in database.');
      return;
    }

    const staffMembers = staffResult.rows;
    console.log(`✅ Found ${staffMembers.length} staff members`);
    staffMembers.forEach(s => console.log(`   - ${s.staff_name} (${s.staff_email})`));

    // Update staff members with rostering fields
    const staffUpdates = [
      {
        id: staffMembers[0].id,
        base_hourly_rate: 60000,
        discord_username: staffMembers[0].staff_name.toLowerCase().replace(/\s+/g, '_'),
        has_keys: true,
        available_roles: ['cafe', 'floor', 'opening', 'closing']
      },
      {
        id: staffMembers[1].id,
        base_hourly_rate: 45000,
        discord_username: staffMembers[1].staff_name.toLowerCase().replace(/\s+/g, '_'),
        has_keys: false,
        available_roles: ['cafe', 'floor']
      },
      {
        id: staffMembers[2].id,
        base_hourly_rate: 50000,
        discord_username: staffMembers[2].staff_name.toLowerCase().replace(/\s+/g, '_'),
        has_keys: true,
        available_roles: ['cafe', 'floor', 'opening', 'closing']
      }
    ];

    for (const staff of staffUpdates) {
      await client.query(
        `UPDATE staff_list
         SET base_hourly_rate = $1,
             discord_username = $2,
             has_keys = $3,
             available_roles = $4
         WHERE id = $5`,
        [staff.base_hourly_rate, staff.discord_username, staff.has_keys, staff.available_roles, staff.id]
      );
      console.log(`✅ Updated ${staff.discord_username} with rostering fields`);
    }

    // Step 3: Create availability patterns
    console.log('\n📝 Step 3: Creating availability patterns...');

    const availabilityPatterns = [
      // Staff 1: Full-time, 9am-5pm weekdays
      { staff_id: staffMembers[0].id, day_of_week: 'Monday', hour_start: 9, hour_end: 17, status: 'available' },
      { staff_id: staffMembers[0].id, day_of_week: 'Tuesday', hour_start: 9, hour_end: 17, status: 'available' },
      { staff_id: staffMembers[0].id, day_of_week: 'Wednesday', hour_start: 9, hour_end: 17, status: 'available' },
      { staff_id: staffMembers[0].id, day_of_week: 'Thursday', hour_start: 9, hour_end: 17, status: 'available' },
      { staff_id: staffMembers[0].id, day_of_week: 'Friday', hour_start: 9, hour_end: 17, status: 'available' },
      { staff_id: staffMembers[0].id, day_of_week: 'Saturday', hour_start: 9, hour_end: 23, status: 'unavailable' },
      { staff_id: staffMembers[0].id, day_of_week: 'Sunday', hour_start: 9, hour_end: 23, status: 'unavailable' },

      // Staff 2: Part-time, evenings + weekends
      { staff_id: staffMembers[1].id, day_of_week: 'Monday', hour_start: 17, hour_end: 22, status: 'available' },
      { staff_id: staffMembers[1].id, day_of_week: 'Tuesday', hour_start: 17, hour_end: 22, status: 'available' },
      { staff_id: staffMembers[1].id, day_of_week: 'Wednesday', hour_start: 17, hour_end: 22, status: 'available' },
      { staff_id: staffMembers[1].id, day_of_week: 'Thursday', hour_start: 9, hour_end: 23, status: 'unavailable' },
      { staff_id: staffMembers[1].id, day_of_week: 'Friday', hour_start: 9, hour_end: 23, status: 'unavailable' },
      { staff_id: staffMembers[1].id, day_of_week: 'Saturday', hour_start: 10, hour_end: 18, status: 'available' },
      { staff_id: staffMembers[1].id, day_of_week: 'Sunday', hour_start: 10, hour_end: 18, status: 'available' },

      // Staff 3: Full-time, flexible
      { staff_id: staffMembers[2].id, day_of_week: 'Monday', hour_start: 10, hour_end: 18, status: 'available' },
      { staff_id: staffMembers[2].id, day_of_week: 'Tuesday', hour_start: 10, hour_end: 18, status: 'available' },
      { staff_id: staffMembers[2].id, day_of_week: 'Wednesday', hour_start: 9, hour_end: 23, status: 'unavailable' },
      { staff_id: staffMembers[2].id, day_of_week: 'Thursday', hour_start: 10, hour_end: 18, status: 'available' },
      { staff_id: staffMembers[2].id, day_of_week: 'Friday', hour_start: 10, hour_end: 18, status: 'available' },
      { staff_id: staffMembers[2].id, day_of_week: 'Saturday', hour_start: 10, hour_end: 18, status: 'available' },
      { staff_id: staffMembers[2].id, day_of_week: 'Sunday', hour_start: 9, hour_end: 23, status: 'unavailable' }
    ];

    for (const pattern of availabilityPatterns) {
      await client.query(
        `INSERT INTO staff_availability
         (staff_id, day_of_week, hour_start, hour_end, availability_status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (staff_id, day_of_week, hour_start, hour_end)
         DO UPDATE SET
           availability_status = EXCLUDED.availability_status`,
        [
          pattern.staff_id,
          pattern.day_of_week,
          pattern.hour_start,
          pattern.hour_end,
          pattern.status
        ]
      );
    }

    console.log(`✅ Created ${availabilityPatterns.length} availability patterns`);

    // Step 4: Create roster shifts for current week
    console.log('\n📝 Step 4: Creating roster shifts for current week...');

    const weekStart = getCurrentMonday();
    console.log(`   Using week starting: ${weekStart}`);

    const shifts = [
      // Monday
      { staff_id: staffMembers[0].id, day: 'Monday', type: 'opening', start: '09:00', end: '14:00', role: 'cafe' },
      { staff_id: staffMembers[2].id, day: 'Monday', type: 'day', start: '14:00', end: '18:00', role: 'floor' },
      { staff_id: staffMembers[1].id, day: 'Monday', type: 'closing', start: '17:00', end: '22:00', role: 'cafe' },

      // Tuesday
      { staff_id: staffMembers[0].id, day: 'Tuesday', type: 'opening', start: '09:00', end: '14:00', role: 'cafe' },
      { staff_id: staffMembers[2].id, day: 'Tuesday', type: 'day', start: '14:00', end: '18:00', role: 'floor' },
      { staff_id: staffMembers[1].id, day: 'Tuesday', type: 'closing', start: '17:00', end: '22:00', role: 'cafe' },

      // Wednesday
      { staff_id: staffMembers[0].id, day: 'Wednesday', type: 'opening', start: '09:00', end: '17:00', role: 'cafe' },
      { staff_id: staffMembers[1].id, day: 'Wednesday', type: 'closing', start: '17:00', end: '22:00', role: 'floor' },

      // Thursday
      { staff_id: staffMembers[2].id, day: 'Thursday', type: 'opening', start: '10:00', end: '18:00', role: 'floor' },

      // Friday
      { staff_id: staffMembers[0].id, day: 'Friday', type: 'opening', start: '09:00', end: '17:00', role: 'cafe' },
      { staff_id: staffMembers[2].id, day: 'Friday', type: 'closing', start: '17:00', end: '22:00', role: 'floor' },

      // Saturday (weekend rate)
      { staff_id: staffMembers[2].id, day: 'Saturday', type: 'opening', start: '10:00', end: '18:00', role: 'cafe' },
      { staff_id: staffMembers[1].id, day: 'Saturday', type: 'closing', start: '17:00', end: '22:00', role: 'floor' },

      // Sunday (weekend rate)
      { staff_id: staffMembers[1].id, day: 'Sunday', type: 'day', start: '10:00', end: '18:00', role: 'cafe' }
    ];

    for (const shift of shifts) {
      const result = await client.query(
        `INSERT INTO roster_shifts
         (roster_week_start, day_of_week, shift_type, staff_id, scheduled_start, scheduled_end, role_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [weekStart, shift.day, shift.type, shift.staff_id, shift.start, shift.end, shift.role]
      );

      console.log(`✅ Created ${shift.type} shift on day ${shift.day} for staff ${shift.staff_id.substring(0, 8)}...`);
    }

    console.log(`✅ Created ${shifts.length} roster shifts`);

    // Step 5: Create some test clock-in records
    console.log('\n📝 Step 5: Creating test clock-in records...');

    // Get shift IDs for today's shifts (if any)
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayShifts = await client.query(
      `SELECT id, staff_id, scheduled_start, scheduled_end, day_of_week
       FROM roster_shifts
       WHERE roster_week_start = $1
       AND day_of_week = $2
       LIMIT 2`,
      [weekStart, todayName]
    );

    if (todayShifts.rows.length > 0) {
      for (const shift of todayShifts.rows) {
        // Create a clock-in record that's 5 minutes early (should get +50 points)
        const clockInTime = new Date();
        const [hours, minutes] = shift.scheduled_start.split(':');
        clockInTime.setHours(parseInt(hours), parseInt(minutes) - 5, 0);

        // Clock-in location as JSONB
        const clockInLocation = {
          latitude: 10.762622, // Sip n Play coordinates
          longitude: 106.660172,
          timestamp: clockInTime.toISOString(),
          accuracy: 10
        };

        await client.query(
          `INSERT INTO clock_records
           (staff_id, shift_id, clock_in_time, clock_in_location, rostered_start, rostered_end, points_awarded)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            shift.staff_id,
            shift.id,
            clockInTime,
            JSON.stringify(clockInLocation),
            shift.scheduled_start,
            shift.scheduled_end,
            50 // Early clock-in points
          ]
        );

        console.log(`✅ Created test clock-in for shift ${shift.id.substring(0, 8)}...`);
      }
    } else {
      console.log('ℹ️  No shifts scheduled for today, skipping clock-in records');
    }

    // Summary
    console.log('\n✅ Test data seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`   - Updated ${staffUpdates.length} staff members with rostering fields`);
    console.log(`   - Created ${availabilityPatterns.length} availability patterns`);
    console.log(`   - Created ${shifts.length} roster shifts for week ${weekStart}`);
    console.log(`   - Created ${todayShifts.rows.length} test clock-in records`);

    console.log('\n🧪 Ready for API testing!');
    console.log('   Test these endpoints:');
    console.log(`   - GET /api/roster/${weekStart}`);
    console.log('   - GET /api/staff/availability?staff_id=<uuid>');
    console.log('   - GET /api/clock-in?staff_id=<uuid>');

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
