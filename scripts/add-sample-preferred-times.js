/**
 * Add sample staff preferred times
 *
 * This adds preferred shift times for a few staff members for testing.
 * In production, staff would set these through a preferences UI.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addSamplePreferences() {
  try {
    console.log('Adding sample staff preferred times...\n');

    // Get a few staff members to add preferences for
    const staffResult = await pool.query(`
      SELECT id, staff_name, nickname
      FROM staff_list
      LIMIT 3
    `);

    if (staffResult.rows.length === 0) {
      console.log('❌ No staff members found in database');
      await pool.end();
      return;
    }

    const staff = staffResult.rows;
    console.log(`Found ${staff.length} staff members to add preferences for:\n`);

    let totalAdded = 0;

    // Add preferences for each staff member
    for (const member of staff) {
      const displayName = member.nickname || member.staff_name;
      console.log(`\n📝 Adding preferences for ${displayName}:`);

      // Example preferences (customize these as needed):
      // - Weekdays: prefer mornings (9-13) or afternoons (14-18)
      // - Weekends: prefer full days (10-20)
      const preferences = [
        // Weekday preferences (prefer mornings)
        { day: 'Monday', start: 9, end: 13 },
        { day: 'Tuesday', start: 9, end: 13 },
        { day: 'Wednesday', start: 14, end: 18 },
        { day: 'Thursday', start: 14, end: 18 },
        { day: 'Friday', start: 9, end: 13 },

        // Weekend preferences (prefer full days)
        { day: 'Saturday', start: 10, end: 20 },
        { day: 'Sunday', start: 12, end: 18 },
      ];

      for (const pref of preferences) {
        const result = await pool.query(`
          INSERT INTO staff_preferred_times (staff_id, day_of_week, hour_start, hour_end)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [member.id, pref.day, pref.start, pref.end]);

        const start = String(pref.start).padStart(2, '0');
        const end = String(pref.end).padStart(2, '0');
        console.log(`  ✅ ${pref.day.padEnd(9)} | ${start}:00 - ${end}:00`);
        totalAdded++;
      }
    }

    console.log(`\n\n✅ Added ${totalAdded} preferred time entries for ${staff.length} staff members`);
    console.log('\nNext steps:');
    console.log('  1. Fetch preferred times via /api/roster/preferred-times');
    console.log('  2. Display in calendar hover tooltips');
    console.log('  3. Show in add/edit shift dialog');

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addSamplePreferences();
