/**
 * Add Ivy's weekly availability
 * Typical part-time student schedule:
 * - Unavailable mornings/afternoons (school hours)
 * - Available evenings (5pm-11pm)
 * - Available weekends
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addIvyAvailability() {
  try {
    const ivyId = 'f3cfd993-77f7-4d0f-b6c2-8d8029c006c7';

    console.log('Adding Ivy\'s weekly availability...\n');

    // Ivy's availability pattern:
    // Mon-Fri: Unavailable 0-17 (school hours), Available 17-23 (evenings)
    // Sat-Sun: Available all day
    const availability = [
      // Monday
      { day: 'Monday', start: 0, end: 17, status: 'unavailable' },
      { day: 'Monday', start: 17, end: 23, status: 'available' },

      // Tuesday
      { day: 'Tuesday', start: 0, end: 17, status: 'unavailable' },
      { day: 'Tuesday', start: 17, end: 23, status: 'available' },

      // Wednesday
      { day: 'Wednesday', start: 0, end: 17, status: 'unavailable' },
      { day: 'Wednesday', start: 17, end: 23, status: 'available' },

      // Thursday
      { day: 'Thursday', start: 0, end: 17, status: 'unavailable' },
      { day: 'Thursday', start: 17, end: 23, status: 'available' },

      // Friday
      { day: 'Friday', start: 0, end: 17, status: 'unavailable' },
      { day: 'Friday', start: 17, end: 23, status: 'available' },

      // Saturday - Available all day
      { day: 'Saturday', start: 0, end: 23, status: 'available' },

      // Sunday - Available all day
      { day: 'Sunday', start: 0, end: 23, status: 'available' },
    ];

    let added = 0;
    for (const avail of availability) {
      const result = await pool.query(`
        INSERT INTO staff_availability (staff_id, day_of_week, hour_start, hour_end, availability_status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [ivyId, avail.day, avail.start, avail.end, avail.status]);

      const status = avail.status === 'available' ? '✅ AVAIL  ' : '❌ UNAVAIL';
      const start = String(avail.start).padStart(2, '0');
      const end = String(avail.end).padStart(2, '0');
      console.log(`  ${status} | ${avail.day.padEnd(9)} | ${start}:00 - ${end}:00`);

      added++;
    }

    console.log(`\n✅ Added ${added} availability records for Ivy`);
    console.log('\nSummary:');
    console.log('  Mon-Fri: Available evenings 5pm-11pm (unavailable during school hours)');
    console.log('  Sat-Sun: Available all day');

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

addIvyAvailability();
