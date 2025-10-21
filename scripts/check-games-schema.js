const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    console.log('Checking games table schema...\n');

    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'games'
      ORDER BY ordinal_position;
    `);

    console.log('Current games table columns:');
    console.table(result.rows);

    // Check if base_game_id exists
    const hasBaseGameId = result.rows.some(row => row.column_name === 'base_game_id');
    const hasIsExpansion = result.rows.some(row => row.column_name === 'is_expansion');
    const hasGameExpansionsLink = result.rows.some(row => row.column_name === 'game_expansions_link');

    console.log('\nExpansion-related columns:');
    console.log('- base_game_id:', hasBaseGameId ? '✅ EXISTS' : '❌ MISSING');
    console.log('- is_expansion:', hasIsExpansion ? '✅ EXISTS' : '❌ MISSING');
    console.log('- game_expansions_link:', hasGameExpansionsLink ? '✅ EXISTS' : '❌ MISSING');

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
