const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function checkColumns() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Check play_logs columns
    const playLogsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'play_logs'
      ORDER BY ordinal_position
    `);
    console.log('\nplay_logs columns:', playLogsResult.rows.map(r => r.column_name).join(', '));

    // Check staff_knowledge columns
    const knowledgeResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'staff_knowledge'
      ORDER BY ordinal_position
    `);
    console.log('staff_knowledge columns:', knowledgeResult.rows.map(r => r.column_name).join(', '));
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns().catch(console.error);
