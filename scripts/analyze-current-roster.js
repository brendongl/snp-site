/**
 * Analyze current roster generation results
 * Shows what shifts each constrained staff member is getting
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function analyzeRoster() {
  try {
    // Get current week's shifts with staff assignments
    const shiftsResult = await pool.query(`
      SELECT
        rs.day_of_week,
        rs.scheduled_start,
        rs.scheduled_end,
        rs.role_required,
        sl.nickname,
        sl.staff_name,
        EXTRACT(EPOCH FROM (rs.scheduled_end - rs.scheduled_start))/3600 as hours
      FROM roster_shifts rs
      LEFT JOIN staff_list sl ON rs.assigned_staff_id = sl.id
      WHERE rs.week_start_date = (
        SELECT week_start_date
        FROM roster_shifts
        ORDER BY week_start_date DESC
        LIMIT 1
      )
      ORDER BY
        CASE rs.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        rs.scheduled_start
    `);

    // Get staff availability
    const availabilityResult = await pool.query(`
      SELECT
        sl.nickname,
        sl.staff_name,
        sa.day_of_week,
        sa.hour_start,
        sa.hour_end,
        (sa.hour_end - sa.hour_start) as hours
      FROM staff_availability sa
      JOIN staff_list sl ON sa.staff_id = sl.id
      WHERE sa.availability_status = 'available'
        AND sl.nickname IN ('Long', 'Ivy', 'Nhi', 'Sơn', 'An', 'Vũ')
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

    console.log('\n📊 CONSTRAINED STAFF ANALYSIS\n');
    console.log('='  .repeat(80));

    const constrainedStaff = ['Long', 'An', 'Vũ', 'Sơn', 'Nhi', 'Ivy'];

    for (const staffName of constrainedStaff) {
      console.log(`\n👤 ${staffName}`);
      console.log('-'.repeat(80));

      // Show availability
      const availability = availabilityResult.rows.filter(
        row => row.nickname === staffName
      );

      const totalAvailable = availability.reduce((sum, a) => sum + parseFloat(a.hours), 0);
      console.log(`\n  Available Hours: ${totalAvailable}h`);
      console.log('  Availability:');
      availability.forEach(slot => {
        const start = String(slot.hour_start).padStart(2, '0');
        const end = String(slot.hour_end).padStart(2, '0');
        console.log(`    ${slot.day_of_week.padEnd(10)} ${start}:00-${end}:00 (${slot.hours}h)`);
      });

      // Show assigned shifts
      const assignedShifts = shiftsResult.rows.filter(
        row => row.nickname === staffName
      );

      if (assignedShifts.length === 0) {
        console.log('\n  ❌ NO SHIFTS ASSIGNED');
      } else {
        const totalAssigned = assignedShifts.reduce((sum, s) => sum + parseFloat(s.hours), 0);
        console.log(`\n  Assigned Hours: ${totalAssigned.toFixed(1)}h`);
        console.log('  Assigned Shifts:');
        assignedShifts.forEach(shift => {
          console.log(`    ✅ ${shift.day_of_week.padEnd(10)} ${shift.scheduled_start}-${shift.scheduled_end} (${parseFloat(shift.hours).toFixed(1)}h) [${shift.role_required}]`);
        });

        // Check if assigned shifts match availability
        console.log('\n  Fit Analysis:');
        assignedShifts.forEach(shift => {
          const matchingAvailability = availability.find(a =>
            a.day_of_week === shift.day_of_week
          );

          if (!matchingAvailability) {
            console.log(`    ⚠️  ${shift.day_of_week} shift has NO availability slot!`);
          } else {
            console.log(`    ✓ ${shift.day_of_week} shift fits in ${matchingAvailability.hour_start}:00-${matchingAvailability.hour_end}:00`);
          }
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 SUMMARY\n');

    // Count unassigned shifts
    const unassignedShifts = shiftsResult.rows.filter(row => !row.nickname);
    console.log(`Total Shifts: ${shiftsResult.rows.length}`);
    console.log(`Assigned Shifts: ${shiftsResult.rows.length - unassignedShifts.length}`);
    console.log(`Unassigned Shifts: ${unassignedShifts.length}`);

    // Count constrained staff with shifts
    const constrainedWithShifts = constrainedStaff.filter(name =>
      shiftsResult.rows.some(row => row.nickname === name)
    );
    console.log(`\nConstrained Staff Rostered: ${constrainedWithShifts.length}/6`);
    console.log(`Constrained Staff: ${constrainedWithShifts.join(', ')}`);

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeRoster();
