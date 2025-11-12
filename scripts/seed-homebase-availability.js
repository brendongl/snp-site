/**
 * Seed Staff Availability from Homebase
 *
 * Imports real staff availability patterns from Homebase scheduling system
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Store operating hours
const STORE_HOURS = {
  Monday: { open: '12:00', close: '23:00' },
  Tuesday: { open: '12:30', close: '23:00' },
  Wednesday: { open: '12:00', close: '23:00' },
  Thursday: { open: '12:30', close: '23:00' },
  Friday: { open: '09:00', close: '00:00' }, // midnight next day
  Saturday: { open: '09:00', close: '00:00' },
  Sunday: { open: '09:00', close: '00:00' },
};

// Name mapping: Homebase → Database
const NAME_MAPPING = {
  'An Pham': 'Phạm Nguyễn Thái An',
  'Brendon Gan-Le': 'Brendon Gan-Le',
  'Chase Thanh Phong': 'Nguyen Thanh Phong (Chase)',
  'Hieu Nguyễn': 'Nguyễn Minh Hiếu ',
  'Le Huy': 'Lê Minh Huy',
  'Long Hoang Quang Phi': 'Hoang Quang Phi Long',
  'Đặng Nhật Minh': 'Đặng Nhật Minh',
  'Nhi Nguyen': 'Nguyen Ngoc Bao Nhi',
  'Sơn Nguyễn Thế': 'Nguyễn Thế Sơn',
  'Thọ Nguyễn Phước': 'Nguyễn Phước Thọ ',
  'Vu Thinh Van Hoang': 'Thịnh Văn Hoàng Vũ',
};

// Staff availability data from Homebase
const STAFF_AVAILABILITY = {
  'An Pham': {
    Monday: [{ status: 'unavailable', start: 0, end: 17 }, { status: 'available', start: 17, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Wednesday: [{ status: 'unavailable', start: 9, end: 17 }, { status: 'available', start: 17, end: 23 }],
    Thursday: [{ status: 'unavailable', start: 9, end: 17 }, { status: 'available', start: 17, end: 23 }],
    Friday: [{ status: 'unavailable', start: 0, end: 23 }],
    Saturday: [{ status: 'unavailable', start: 9, end: 17 }, { status: 'available', start: 17, end: 23 }],
    Sunday: [{ status: 'unavailable', start: 9, end: 17 }, { status: 'available', start: 17, end: 23 }],
  },
  'Brendon Gan-Le': {
    // Never available - last resort only
    Monday: [{ status: 'unavailable', start: 0, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Wednesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Thursday: [{ status: 'unavailable', start: 0, end: 23 }],
    Friday: [{ status: 'unavailable', start: 0, end: 23 }],
    Saturday: [{ status: 'unavailable', start: 0, end: 23 }],
    Sunday: [{ status: 'unavailable', start: 0, end: 23 }],
  },
  'Chase Thanh Phong': {
    Monday: [{ status: 'unavailable', start: 0, end: 20 }, { status: 'available', start: 20, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 7, end: 21 }, { status: 'available', start: 0, end: 7 }, { status: 'available', start: 21, end: 23 }],
    Wednesday: [{ status: 'available', start: 0, end: 23 }],
    Thursday: [{ status: 'available', start: 0, end: 16 }, { status: 'unavailable', start: 16, end: 22 }, { status: 'available', start: 22, end: 23 }],
    Friday: [{ status: 'available', start: 0, end: 23 }],
    Saturday: [{ status: 'available', start: 0, end: 23 }],
    Sunday: [{ status: 'available', start: 0, end: 23 }],
  },
  'Hieu Nguyễn': {
    // Always available
    Monday: [{ status: 'available', start: 0, end: 23 }],
    Tuesday: [{ status: 'available', start: 0, end: 23 }],
    Wednesday: [{ status: 'available', start: 0, end: 23 }],
    Thursday: [{ status: 'available', start: 0, end: 23 }],
    Friday: [{ status: 'available', start: 0, end: 23 }],
    Saturday: [{ status: 'available', start: 0, end: 23 }],
    Sunday: [{ status: 'available', start: 0, end: 23 }],
  },
  'Le Huy': {
    Monday: [{ status: 'unavailable', start: 0, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Wednesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Thursday: [{ status: 'unavailable', start: 0, end: 23 }],
    Friday: [{ status: 'available', start: 18, end: 23 }],
    Saturday: [{ status: 'available', start: 18, end: 23 }],
    Sunday: [{ status: 'available', start: 18, end: 23 }],
  },
  'Long Hoang Quang Phi': {
    // Only available during preferred times
    Monday: [{ status: 'unavailable', start: 0, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Wednesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Thursday: [{ status: 'unavailable', start: 0, end: 23 }],
    Friday: [{ status: 'available', start: 19, end: 23 }],
    Saturday: [{ status: 'unavailable', start: 0, end: 23 }],
    Sunday: [{ status: 'available', start: 16, end: 23 }],
  },
  'Đặng Nhật Minh': {
    Monday: [{ status: 'unavailable', start: 0, end: 23 }],
    Tuesday: [{ status: 'available', start: 13, end: 23 }],
    Wednesday: [{ status: 'available', start: 13, end: 23 }],
    Thursday: [{ status: 'unavailable', start: 0, end: 23 }],
    Friday: [{ status: 'available', start: 13, end: 23 }],
    Saturday: [{ status: 'available', start: 13, end: 23 }],
    Sunday: [{ status: 'available', start: 0, end: 23 }],
  },
  'Nhi Nguyen': {
    Monday: [{ status: 'available', start: 0, end: 16 }],
    Tuesday: [{ status: 'available', start: 9, end: 16 }],
    Wednesday: [{ status: 'available', start: 9, end: 16 }],
    Thursday: [{ status: 'available', start: 9, end: 16 }],
    Friday: [{ status: 'available', start: 9, end: 16 }],
    Saturday: [{ status: 'available', start: 9, end: 16 }],
    Sunday: [{ status: 'available', start: 9, end: 16 }],
  },
  // Note: Phong Chu not found in database - skipping
  'Sơn Nguyễn Thế': {
    Monday: [{ status: 'available', start: 0, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Wednesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Thursday: [{ status: 'unavailable', start: 7, end: 17 }, { status: 'available', start: 18, end: 23 }],
    Friday: [{ status: 'available', start: 0, end: 23 }],
    Saturday: [{ status: 'unavailable', start: 0, end: 23 }],
    Sunday: [{ status: 'unavailable', start: 0, end: 23 }],
  },
  'Thọ Nguyễn Phước': {
    Monday: [{ status: 'available', start: 0, end: 23 }],
    Tuesday: [{ status: 'available', start: 0, end: 23 }],
    Wednesday: [{ status: 'available', start: 0, end: 23 }],
    Thursday: [{ status: 'available', start: 0, end: 23 }],
    Friday: [{ status: 'available', start: 0, end: 23 }],
    Saturday: [{ status: 'available', start: 0, end: 23 }],
    Sunday: [{ status: 'available', start: 0, end: 23 }],
  },
  'Vu Thinh Van Hoang': {
    Monday: [{ status: 'unavailable', start: 0, end: 23 }],
    Tuesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Wednesday: [{ status: 'unavailable', start: 0, end: 23 }],
    Thursday: [{ status: 'available', start: 18, end: 23 }],
    Friday: [{ status: 'available', start: 17, end: 22 }],
    Saturday: [{ status: 'available', start: 12, end: 18 }],
    Sunday: [{ status: 'available', start: 0, end: 23 }],
  },
};

async function seedAvailability() {
  const client = await pool.connect();

  try {
    console.log('🌱 Seeding staff availability from Homebase...\n');

    // Get all staff members
    const staffResult = await client.query('SELECT id, staff_name FROM staff_list ORDER BY staff_name');
    const staffMap = {};
    staffResult.rows.forEach(row => {
      staffMap[row.staff_name] = row.id;
    });

    console.log(`📋 Found ${staffResult.rowCount} staff members in database\n`);

    // Clear existing availability
    await client.query('DELETE FROM staff_availability');
    console.log('🗑️  Cleared existing availability data\n');

    let insertedCount = 0;
    let skippedCount = 0;

    // Insert availability for each staff member
    for (const [homebaseName, availability] of Object.entries(STAFF_AVAILABILITY)) {
      // Map Homebase name to database name
      const dbName = NAME_MAPPING[homebaseName] || homebaseName;
      const staffId = staffMap[dbName];

      if (!staffId) {
        console.log(`⚠️  Staff member "${homebaseName}" (DB: "${dbName}") not found in database - skipping`);
        skippedCount++;
        continue;
      }

      console.log(`📅 Adding availability for ${homebaseName} → ${dbName}...`);

      for (const [day, slots] of Object.entries(availability)) {
        for (const slot of slots) {
          await client.query(`
            INSERT INTO staff_availability (
              staff_id,
              day_of_week,
              hour_start,
              hour_end,
              availability_status
            ) VALUES ($1, $2, $3, $4, $5)
          `, [staffId, day, slot.start, slot.end, slot.status]);

          insertedCount++;
        }
      }

      console.log(`   ✅ Added ${Object.values(availability).flat().length} availability slots`);
    }

    console.log(`\n✅ Availability import complete!`);
    console.log(`   Total slots inserted: ${insertedCount}`);
    console.log(`   Staff members processed: ${Object.keys(STAFF_AVAILABILITY).length}`);
    console.log(`   Staff members skipped: ${skippedCount}`);

  } catch (error) {
    console.error('❌ Error seeding availability:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedShiftRequirements() {
  const client = await pool.connect();

  try {
    console.log('\n🕐 Creating shift requirements based on store hours...\n');

    const shiftRequirements = [];

    for (const [day, hours] of Object.entries(STORE_HOURS)) {
      const openHour = parseInt(hours.open.split(':')[0]);
      const closeHour = hours.close === '00:00' ? 24 : parseInt(hours.close.split(':')[0]);

      console.log(`${day}: ${hours.open} - ${hours.close === '00:00' ? 'midnight' : hours.close}`);

      // Opening shift (first staff member of the day)
      shiftRequirements.push({
        day,
        type: 'opening',
        start: hours.open,
        end: `${Math.min(openHour + 5, closeHour)}:00`,
        role: 'cafe',
        requires_keys: true
      });

      // Mid-day shift (if store is open long enough)
      if (closeHour - openHour > 8) {
        const midStart = openHour + 4;
        const midEnd = Math.min(midStart + 6, closeHour - 2);

        shiftRequirements.push({
          day,
          type: 'day',
          start: `${midStart}:00`,
          end: `${midEnd}:00`,
          role: 'floor',
          requires_keys: false
        });
      }

      // Evening shift (last few hours before close)
      const eveningStart = Math.max(closeHour - 5, openHour + 4);
      shiftRequirements.push({
        day,
        type: 'evening',
        start: `${eveningStart}:00`,
        end: hours.close === '00:00' ? '23:59' : hours.close,
        role: 'floor',
        requires_keys: false
      });

      // Closing shift (requires keys)
      const closingStart = closeHour - 1;
      shiftRequirements.push({
        day,
        type: 'closing',
        start: `${closingStart}:00`,
        end: hours.close,
        role: 'cafe',
        requires_keys: true
      });
    }

    console.log(`\n📊 Created ${shiftRequirements.length} shift requirement templates`);
    console.log('   These will be used when generating rosters\n');

    // Note: Shift requirements are used dynamically in roster generation
    // They don't need to be stored in database as static data

  } catch (error) {
    console.error('❌ Error creating shift requirements:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function seedSchedulingRules() {
  const client = await pool.connect();

  try {
    console.log('📜 Adding scheduling rules...\n');

    // Get Brendon's ID for the last resort rule
    const brendonResult = await client.query(
      "SELECT id FROM staff_list WHERE staff_name = 'Brendon Gan-Le'"
    );

    if (brendonResult.rows.length === 0) {
      console.log('⚠️  Brendon not found - skipping last resort rule');
      return;
    }

    const brendonId = brendonResult.rows[0].id;

    // Clear existing rules
    await client.query('DELETE FROM roster_rules');

    // Rule 1: Brendon is last resort only
    await client.query(`
      INSERT INTO roster_rules (
        rule_text,
        parsed_constraint,
        weight,
        created_by,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      'Brendon should only be scheduled as a last resort when no other staff available',
      JSON.stringify({
        type: 'priority',
        staff_id: brendonId,
        priority: 'last_resort',
        penalty: 90
      }),
      90,
      brendonId,
      true
    ]);

    // Rule 2: Opening shifts require keys
    await client.query(`
      INSERT INTO roster_rules (
        rule_text,
        parsed_constraint,
        weight,
        created_by,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      'All opening shifts require staff members with store keys',
      JSON.stringify({
        type: 'requires_keys_for_opening',
        requires_keys: true
      }),
      100,
      brendonId,
      true
    ]);

    // Rule 3: Closing shifts require keys
    await client.query(`
      INSERT INTO roster_rules (
        rule_text,
        parsed_constraint,
        weight,
        created_by,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      'All closing shifts require staff members with store keys',
      JSON.stringify({
        type: 'requires_keys_for_closing',
        requires_keys: true
      }),
      100,
      brendonId,
      true
    ]);

    // Rule 4: Fairness in hour distribution
    await client.query(`
      INSERT INTO roster_rules (
        rule_text,
        parsed_constraint,
        weight,
        created_by,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      'Try to keep hour distribution fair across all staff (within 10 hours difference)',
      JSON.stringify({
        type: 'fairness',
        max_hour_difference: 10
      }),
      70,
      brendonId,
      true
    ]);

    console.log('✅ Added 4 scheduling rules');
    console.log('   - Brendon last resort rule (weight: 90)');
    console.log('   - Opening shifts require keys (weight: 100)');
    console.log('   - Closing shifts require keys (weight: 100)');
    console.log('   - Fairness distribution (weight: 70)\n');

  } catch (error) {
    console.error('❌ Error seeding scheduling rules:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await seedAvailability();
    await seedShiftRequirements();
    await seedSchedulingRules();

    console.log('🎉 All data seeded successfully!\n');
    console.log('Next steps:');
    console.log('1. Test roster generation: node scripts/test-roster-generation.js');
    console.log('2. View in Phase 3 UI (when built)');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
