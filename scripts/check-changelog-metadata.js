const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkChangelog() {
  try {
    const result = await pool.query(`
      SELECT
        category,
        event_type,
        description,
        staff_member,
        metadata,
        created_at
      FROM changelog
      ORDER BY created_at DESC
      LIMIT 15
    `);

    console.log('=== Sample Changelog Records ===\n');
    result.rows.forEach((row, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  Category: ${row.category}`);
      console.log(`  Event: ${row.event_type}`);
      console.log(`  Staff: ${row.staff_member}`);
      console.log(`  Description: ${row.description}`);
      console.log(`  Metadata: ${JSON.stringify(row.metadata, null, 2)}`);
      console.log('---\n');
    });

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkChangelog();
