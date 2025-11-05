/**
 * Populate staff nicknames
 *
 * Sets nicknames for all staff members:
 * - Most staff: Use last name (last word in full name)
 * - Nguyen Thanh Phong (Chase): "Chase"
 * - Brendon Gan-Le: "Brendon"
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function populateNicknames() {
  try {
    console.log('📝 Fetching all staff members...\n');

    const result = await pool.query(`
      SELECT id, staff_name, nickname
      FROM staff_list
      ORDER BY staff_name
    `);

    console.log(`Found ${result.rows.length} staff members\n`);

    for (const staff of result.rows) {
      let nickname;

      // Special cases
      if (staff.staff_name === 'Nguyen Thanh Phong (Chase)') {
        nickname = 'Chase';
      } else if (staff.staff_name === 'Brendon Gan-Le') {
        nickname = 'Brendon';
      } else if (staff.staff_name === 'Ivy') {
        // Already a single name
        nickname = 'Ivy';
      } else {
        // Extract last name (last word)
        const nameParts = staff.staff_name.trim().split(/\s+/);
        nickname = nameParts[nameParts.length - 1];
      }

      console.log(`  ${staff.staff_name} => ${nickname}`);

      // Update the database
      await pool.query(
        'UPDATE staff_list SET nickname = $1 WHERE id = $2',
        [nickname, staff.id]
      );
    }

    console.log('\n✅ All nicknames updated successfully!');

    // Verify the updates
    console.log('\n📋 Verifying updates...\n');
    const verify = await pool.query(`
      SELECT staff_name, nickname
      FROM staff_list
      ORDER BY staff_name
    `);

    verify.rows.forEach(row => {
      console.log(`  ✓ ${row.staff_name} => ${row.nickname}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

populateNicknames();
