/**
 * Check existing availability pattern to understand the data structure
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPattern() {
  try {
    // Get sample staff availability pattern
    console.log('=== Sample Staff Availability Pattern (Chase) ===\n');
    const chaseAvail = await pool.query(`
      SELECT
        day_of_week,
        hour_start,
        hour_end,
        availability_status
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      WHERE sl.nickname = 'Chase'
      ORDER BY
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        hour_start
    `);

    chaseAvail.rows.forEach(row => {
      const status = row.availability_status === 'available' ? '✅ AVAIL  ' : '❌ UNAVAIL';
      const start = String(row.hour_start).padStart(2, '0');
      const end = String(row.hour_end).padStart(2, '0');
      console.log(`  ${status} | ${row.day_of_week.padEnd(9)} | ${start}:00 - ${end}:00`);
    });

    console.log('\n=== Another Sample (An) ===\n');
    const anAvail = await pool.query(`
      SELECT
        day_of_week,
        hour_start,
        hour_end,
        availability_status
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      WHERE sl.nickname = 'An'
      ORDER BY
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        hour_start
    `);

    anAvail.rows.forEach(row => {
      const status = row.availability_status === 'available' ? '✅ AVAIL  ' : '❌ UNAVAIL';
      const start = String(row.hour_start).padStart(2, '0');
      const end = String(row.hour_end).padStart(2, '0');
      console.log(`  ${status} | ${row.day_of_week.padEnd(9)} | ${start}:00 - ${end}:00`);
    });

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkPattern();
