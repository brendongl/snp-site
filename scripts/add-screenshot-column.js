const { Pool } = require('pg');

const connectionUrl = process.argv.find(arg => arg.startsWith('--db='))?.split('=')[1] || process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('📝 Adding image_screenshot_url column to video_games table');
console.log('Connection:', connectionUrl.split('@')[1] || 'local');
console.log('');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function addColumn() {
  const client = await pool.connect();

  try {
    // Check if column already exists
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'video_games'
      AND column_name = 'image_screenshot_url'
    `;

    const checkResult = await client.query(checkQuery);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column image_screenshot_url already exists');
      return;
    }

    // Add column
    const addColumnQuery = `
      ALTER TABLE video_games
      ADD COLUMN image_screenshot_url TEXT
    `;

    await client.query(addColumnQuery);
    console.log('✅ Added column: image_screenshot_url');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addColumn()
  .then(() => {
    console.log('\n🎉 Column added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
