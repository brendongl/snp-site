/**
 * Check availability for staff members who aren't getting rostered
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkConstrainedStaffAvailability() {
  try {
    const result = await pool.query(`
      SELECT
        sl.staff_name,
        sl.nickname,
        sa.day_of_week,
        sa.hour_start,
        sa.hour_end,
        sa.availability_status
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      WHERE sl.nickname IN ('Long', 'Ivy', 'Nhi', 'Sơn', 'An', 'Vũ')
      ORDER BY sl.nickname,
        CASE sa.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        sa.hour_start
    `);

    console.log('\n📊 Availability for 6 staff not getting rostered:\n');
    let currentStaff = '';
    let totalHours = 0;
    let staffHours = {};

    result.rows.forEach(row => {
      if (row.nickname !== currentStaff) {
        if (currentStaff && staffHours[currentStaff]) {
          console.log(`  Total: ${staffHours[currentStaff]}h available\n`);
        }
        currentStaff = row.nickname;
        staffHours[currentStaff] = 0;
        console.log(`${row.nickname || row.staff_name}:`);
      }

      const status = row.availability_status === 'available' ? '✅' :
                     row.availability_status === 'preferred_not' ? '⚠️' : '❌';
      const hours = row.hour_end - row.hour_start;

      if (row.availability_status === 'available') {
        staffHours[currentStaff] += hours;
      }

      console.log(`  ${row.day_of_week}: ${row.hour_start}:00-${row.hour_end}:00 (${hours}h) ${status}`);
    });

    // Print last staff's total
    if (currentStaff && staffHours[currentStaff]) {
      console.log(`  Total: ${staffHours[currentStaff]}h available\n`);
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkConstrainedStaffAvailability();
