const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🎮 Video Games Table Setup Script');
console.log('==================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function createVideoGamesTable() {
  const client = await pool.connect();
  try {
    console.log('\n1️⃣  Creating video_games table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS video_games (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        publisher TEXT,
        developer TEXT,
        release_date INTEGER,
        description TEXT,
        category TEXT[],
        languages TEXT[],
        number_of_players INTEGER,
        rating_content TEXT[],
        platform_specific_data JSONB,
        located_on TEXT[],
        image_url TEXT,
        image_landscape_url TEXT,
        image_portrait_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_game_platform UNIQUE(id, platform)
      );
    `);
    console.log('   ✓ video_games table created');

    console.log('\n2️⃣  Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_games_platform
      ON video_games(platform);
    `);
    console.log('   ✓ Platform index created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_games_located_on
      ON video_games USING GIN(located_on);
    `);
    console.log('   ✓ Located_on GIN index created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_games_category
      ON video_games USING GIN(category);
    `);
    console.log('   ✓ Category GIN index created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_video_games_name
      ON video_games(name);
    `);
    console.log('   ✓ Name index created');

    console.log('\n3️⃣  Verifying table structure...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'video_games'
      ORDER BY ordinal_position;
    `);

    console.log('\n   Table columns:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(required)' : ''}`);
    });

    console.log('\n✅ Video games table setup complete!');
    console.log('\nTable ready for:');
    console.log('  - Nintendo Switch games (platform: "switch")');
    console.log('  - PS5 games (platform: "ps5")');
    console.log('  - Xbox games (platform: "xbox")');
    console.log('  - Other gaming platforms');

  } catch (error) {
    console.error('\n❌ Error creating video_games table:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createVideoGamesTable()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
