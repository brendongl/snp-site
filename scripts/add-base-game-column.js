const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addBaseGameColumn() {
  const client = await pool.connect();

  try {
    console.log('🔧 Adding base_game_id column to games table...\n');

    await client.query('BEGIN');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'games' AND column_name = 'base_game_id';
    `);

    if (checkColumn.rows.length > 0) {
      console.log('⚠️  Column base_game_id already exists. Skipping.');
      await client.query('COMMIT');
      return;
    }

    // Add the base_game_id column
    await client.query(`
      ALTER TABLE games
      ADD COLUMN base_game_id VARCHAR(50);
    `);

    console.log('✅ Added base_game_id column');

    // Add foreign key constraint (self-referencing)
    await client.query(`
      ALTER TABLE games
      ADD CONSTRAINT fk_base_game
      FOREIGN KEY (base_game_id)
      REFERENCES games(id)
      ON DELETE SET NULL;
    `);

    console.log('✅ Added foreign key constraint');

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX idx_base_game_id ON games(base_game_id);
    `);

    console.log('✅ Created index on base_game_id');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/migrate-expansions-from-airtable.js');
    console.log('2. This will populate base_game_id from Airtable data');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error adding base_game_id column:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addBaseGameColumn();
