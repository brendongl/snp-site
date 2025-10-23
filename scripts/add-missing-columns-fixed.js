const { Pool } = require('pg');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 PostgreSQL Migration: Add Missing Columns (Fixed)');
console.log('====================================================\n');

const pool = new Pool({ connectionString: connectionUrl });

async function addMissingColumns() {
  const client = await pool.connect();
  try {
    console.log('✓ Connected to PostgreSQL\n');

    // Add columns one by one with explicit error handling
    const columnsToAdd = [
      { name: 'cost_price', type: 'DECIMAL(10,2)' },
      { name: 'game_size', type: 'VARCHAR(10)' },
      { name: 'deposit', type: 'DECIMAL(10,2)' },
      { name: 'bgg_id', type: 'VARCHAR(50)' },
      { name: 'min_playtime', type: 'INTEGER' },
      { name: 'max_playtime', type: 'INTEGER' },
    ];

    console.log('1️⃣  Adding missing columns...\n');

    for (const column of columnsToAdd) {
      try {
        // Check if column exists
        const checkResult = await client.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name='games' AND column_name=$1
        `, [column.name]);

        if (checkResult.rows.length > 0) {
          console.log(`   ℹ️  Column ${column.name} already exists`);
        } else {
          // Add column
          await client.query(`ALTER TABLE games ADD COLUMN ${column.name} ${column.type}`);
          console.log(`   ✓ Added column: ${column.name} (${column.type})`);
        }
      } catch (err) {
        console.error(`   ❌ Error with column ${column.name}:`, err.message);
        throw err;
      }
    }

    console.log('\n2️⃣  Creating indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_games_bgg_id ON games(bgg_id)`);
    console.log('   ✓ Created index on bgg_id');

    console.log('\n3️⃣  Verifying columns were added...\n');
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name='games'
      AND column_name IN ('cost_price', 'game_size', 'deposit', 'bgg_id', 'min_playtime', 'max_playtime')
      ORDER BY column_name
    `);

    if (verifyResult.rows.length === 6) {
      console.log('   ✓ All 6 columns verified in database:');
      verifyResult.rows.forEach(row => {
        console.log(`     - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log(`   ⚠️  Only ${verifyResult.rows.length} of 6 columns found!`);
      verifyResult.rows.forEach(row => {
        console.log(`     - ${row.column_name}`);
      });
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

addMissingColumns();
