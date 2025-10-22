const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 PostgreSQL Migration: Add Mechanisms Column');
console.log('==============================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function addMechanismsColumn() {
  const client = await pool.connect();
  try {
    console.log('\n1️⃣  Checking if mechanisms column exists...');
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name='games' AND column_name='mechanisms'
    `);

    if (checkResult.rows.length > 0) {
      console.log('   ℹ️  Mechanisms column already exists. Skipping migration.');
      return;
    }

    console.log('   ✓ Column does not exist, proceeding with migration...');

    console.log('\n2️⃣  Adding mechanisms column to games table...');
    await client.query(`
      ALTER TABLE games
      ADD COLUMN mechanisms TEXT[] DEFAULT ARRAY[]::TEXT[]
    `);
    console.log('   ✓ Mechanisms column added successfully');

    console.log('\n3️⃣  Creating index for mechanisms column...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_games_mechanisms ON games USING GIN(mechanisms)
    `);
    console.log('   ✓ Index created');

    console.log('\n✅ Migration completed successfully!');
    console.log('   The games table now has a mechanisms column (TEXT[]).');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

addMechanismsColumn();
