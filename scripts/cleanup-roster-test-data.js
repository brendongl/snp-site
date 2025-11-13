/**
 * Clean up roster test data for 2025-11-10
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanup() {
  try {
    // Delete all shifts for test week
    const shifts = await pool.query(
      'DELETE FROM roster_shifts WHERE roster_week_start = $1 RETURNING id',
      ['2025-11-10']
    );

    // Delete metadata for test week
    const metadata = await pool.query(
      'DELETE FROM roster_metadata WHERE roster_week_start = $1 RETURNING id',
      ['2025-11-10']
    );

    console.log(`✅ Deleted ${shifts.rowCount} shifts`);
    console.log(`✅ Deleted ${metadata.rowCount} metadata records`);

    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

cleanup();
