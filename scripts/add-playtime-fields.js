const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('⏱️  Adding Playtime Fields to Games Table');
console.log('==========================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function addPlaytimeFields() {
  const client = await pool.connect();
  try {
    console.log('\n1️⃣  Checking if playtime fields exist...');

    // Check if columns already exist
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'games'
      AND column_name IN ('min_playtime', 'max_playtime')
    `);

    const existingColumns = checkResult.rows.map(row => row.column_name);

    if (existingColumns.includes('min_playtime') && existingColumns.includes('max_playtime')) {
      console.log('   ℹ️  Playtime fields already exist, skipping creation');
      return;
    }

    console.log('\n2️⃣  Adding playtime fields to games table...');

    // Add min_playtime if it doesn't exist
    if (!existingColumns.includes('min_playtime')) {
      await client.query(`
        ALTER TABLE games
        ADD COLUMN min_playtime INTEGER
      `);
      console.log('   ✓ Added min_playtime column');
    } else {
      console.log('   ℹ️  min_playtime already exists');
    }

    // Add max_playtime if it doesn't exist
    if (!existingColumns.includes('max_playtime')) {
      await client.query(`
        ALTER TABLE games
        ADD COLUMN max_playtime INTEGER
      `);
      console.log('   ✓ Added max_playtime column');
    } else {
      console.log('   ℹ️  max_playtime already exists');
    }

    console.log('\n3️⃣  Creating index for playtime queries...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_games_playtime ON games(min_playtime, max_playtime)
    `);
    console.log('   ✓ Index created');

    console.log('\n✅ Playtime fields added successfully!');
    console.log('\n📊 Next steps:');
    console.log('   1. Run populate-playtime-data.js to fetch playtime from BGG API');
    console.log('   2. Update TypeScript types in types/index.ts');
    console.log('   3. Update UI components to display playtime\n');

  } catch (error) {
    console.error('❌ Error adding playtime fields:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

addPlaytimeFields();
