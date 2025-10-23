const { Pool } = require('pg');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

const pool = new Pool({ connectionString: connectionUrl });

async function checkSchema() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'games'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Current games table schema:\n');
    console.log('Column Name                  | Data Type        | Nullable');
    console.log('-----------------------------------------------------------');
    result.rows.forEach(row => {
      console.log(
        `${row.column_name.padEnd(28)} | ${row.data_type.padEnd(16)} | ${row.is_nullable}`
      );
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    await pool.end();
  }
}

checkSchema();
