/**
 * Fix staff_availability hours constraint
 *
 * Problem: Database constraint only allowed hours 0-23, but frontend uses extended hours (0-26)
 *          for overnight times (24=12am, 25=1am, 26=2am end time).
 *
 * Solution: Update constraint to allow hours 0-26 to match API and frontend expectations.
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixConstraint() {
  try {
    console.log('🔧 Fixing staff_availability hours constraint...');

    // Drop old constraint
    await pool.query('ALTER TABLE staff_availability DROP CONSTRAINT IF EXISTS valid_hours');
    console.log('✅ Dropped old valid_hours constraint');

    // Add new constraint that allows extended hours (0-26 for 2am)
    await pool.query(`
      ALTER TABLE staff_availability
      ADD CONSTRAINT valid_hours
      CHECK ((hour_start >= 0) AND (hour_start <= 25) AND (hour_end >= 0) AND (hour_end <= 26))
    `);
    console.log('✅ Added new valid_hours constraint (0-26)');
    console.log('   Extended hours now supported:');
    console.log('   - 24 = 12am (midnight)');
    console.log('   - 25 = 1am');
    console.log('   - 26 = 2am (end time only)');

    await pool.end();
    console.log('\n✨ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

fixConstraint();
