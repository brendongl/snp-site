const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function checkTables() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const result = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('Production tables:', result.rows.map(r => r.tablename));
    console.log('Total:', result.rows.length, 'tables');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();
