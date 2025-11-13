/**
 * Create staff_time_off table for one-time unavailability
 * This is separate from staff_availability (weekly recurring)
 *
 * Use cases:
 * - Vacation days
 * - Sick leave
 * - Personal time off
 * - One-time unavailability
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createStaffTimeOffTable() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creating staff_time_off table...');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_time_off (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_id UUID REFERENCES staff_list(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        time_start TIME DEFAULT '00:00',
        time_end TIME DEFAULT '23:59',
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Ensure no overlapping time-off for same staff on same date
        CONSTRAINT unique_staff_date_time UNIQUE (staff_id, date, time_start, time_end)
      );
    `);

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_time_off_staff_id
      ON staff_time_off(staff_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_time_off_date
      ON staff_time_off(date);
    `);

    console.log('✅ staff_time_off table created');

    // Add mock time-off for Ivy on Mon Nov 17
    console.log('\nAdding mock time-off for Ivy on Monday November 17, 2025...');

    const ivyId = 'f3cfd993-77f7-4d0f-b6c2-8d8029c006c7';

    const result = await client.query(`
      INSERT INTO staff_time_off (staff_id, date, time_start, time_end, reason)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (staff_id, date, time_start, time_end) DO NOTHING
      RETURNING *
    `, [ivyId, '2025-11-17', '00:00', '23:59', 'Mock test - unavailable all day']);

    if (result.rows.length > 0) {
      console.log('✅ Mock time-off added for Ivy:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('⚠️  Time-off already exists for Ivy on this date');
    }

    await client.query('COMMIT');

    console.log('\n✅ All done!');
    console.log('\nSchema:');
    console.log('  staff_time_off (id, staff_id, date, time_start, time_end, reason)');
    console.log('  - One-time unavailability (e.g., vacation, sick days)');
    console.log('  - Separate from staff_availability (weekly recurring)');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createStaffTimeOffTable();
