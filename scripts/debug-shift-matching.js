/**
 * Debug: Why are constrained staff not matching shifts?
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function debugShiftMatching() {
  try {
    // Get An's availability
    const anResult = await pool.query(`
      SELECT day_of_week, hour_start, hour_end, availability_status
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      WHERE sl.nickname = 'An' AND sa.availability_status = 'available'
      ORDER BY CASE sa.day_of_week
        WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
        WHEN 'Sunday' THEN 7
      END
    `);

    console.log('\n📋 An\'s available times:');
    anResult.rows.forEach(row => {
      console.log(`  ${row.day_of_week}: ${row.hour_start}:00-${row.hour_end}:00`);
    });

    // Simulate typical evening shifts
    const eveningShifts = [
      { day: 'Monday', start: '18:00', end: '23:00' },
      { day: 'Wednesday', start: '18:00', end: '23:00' },
      { day: 'Thursday', start: '18:00', end: '23:00' },
      { day: 'Saturday', start: '18:00', end: '23:00' },
      { day: 'Sunday', start: '18:00', end: '23:00' },
    ];

    console.log('\n🔍 Testing shift matches for An:');
    eveningShifts.forEach(shift => {
      const shiftStartHour = parseInt(shift.start.split(':')[0]);
      const shiftEndHour = parseInt(shift.end.split(':')[0]);

      const matchingSlot = anResult.rows.find(slot => {
        return (
          slot.day_of_week === shift.day &&
          slot.hour_start <= shiftStartHour &&
          slot.hour_end >= shiftEndHour
        );
      });

      if (matchingSlot) {
        console.log(`  ✅ ${shift.day} ${shift.start}-${shift.end} MATCHES (availability: ${matchingSlot.hour_start}:00-${matchingSlot.hour_end}:00)`);
      } else {
        console.log(`  ❌ ${shift.day} ${shift.start}-${shift.end} NO MATCH`);
      }
    });

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debugShiftMatching();
