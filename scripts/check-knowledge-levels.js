const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  const levels = await pool.query(`
    SELECT confidence_level, COUNT(*) as count
    FROM staff_knowledge
    GROUP BY confidence_level
    ORDER BY count DESC
  `);

  console.log('Knowledge levels breakdown:');
  levels.rows.forEach(r => {
    console.log(`  ${r.confidence_level || 'NULL'}: ${r.count} records`);
  });

  await pool.end();
}

check();
