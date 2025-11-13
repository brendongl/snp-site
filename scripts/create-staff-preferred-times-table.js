/**
 * Create staff_preferred_times table
 *
 * This table stores when staff PREFER to work (different from availability).
 * Availability = when they CAN work
 * Preferred times = when they WANT to work
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTable() {
  try {
    console.log('Creating staff_preferred_times table...\n');

    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_preferred_times (
        id SERIAL PRIMARY KEY,
        staff_id UUID NOT NULL REFERENCES staff_list(id) ON DELETE CASCADE,
        day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
        hour_start INTEGER NOT NULL CHECK (hour_start >= 0 AND hour_start <= 23),
        hour_end INTEGER NOT NULL CHECK (hour_end >= 0 AND hour_end <= 23),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('✅ Created staff_preferred_times table');

    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_preferred_times_staff_id
      ON staff_preferred_times(staff_id);
    `);

    console.log('✅ Created index on staff_id');

    // Create index for day lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_preferred_times_day
      ON staff_preferred_times(day_of_week);
    `);

    console.log('✅ Created index on day_of_week');

    // Check the schema
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staff_preferred_times'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Table Schema:');
    schemaCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    console.log('\n✅ staff_preferred_times table created successfully!');
    console.log('\nNext steps:');
    console.log('  1. Add preferred times for staff (create another script)');
    console.log('  2. Create API endpoint to fetch preferred times');
    console.log('  3. Display in calendar hover tooltips');
    console.log('  4. Show in add/edit shift dialog');

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createTable();
