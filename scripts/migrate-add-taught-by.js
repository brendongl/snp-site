const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 Adding taught_by column to staff_knowledge table');
console.log('==================================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('\n1️⃣  Adding taught_by column to staff_knowledge...');
    await client.query(`
      ALTER TABLE staff_knowledge
      ADD COLUMN IF NOT EXISTS taught_by VARCHAR(100);
    `);
    console.log('   ✓ taught_by column added');

    console.log('\n2️⃣  Fixing confidence_level type (VARCHAR to INTEGER)...');
    // First check if the column is already integer
    const checkType = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'staff_knowledge' AND column_name = 'confidence_level';
    `);

    if (checkType.rows[0]?.data_type !== 'integer') {
      console.log('   Converting confidence_level from VARCHAR to INTEGER...');
      await client.query(`
        ALTER TABLE staff_knowledge
        ALTER COLUMN confidence_level TYPE INTEGER USING CASE
          WHEN confidence_level ~ '^[0-9]+$' THEN confidence_level::integer
          WHEN confidence_level = 'Beginner' THEN 1
          WHEN confidence_level = 'Intermediate' THEN 2
          WHEN confidence_level = 'Expert' THEN 3
          WHEN confidence_level = 'Instructor' THEN 4
          ELSE 1
        END;
      `);
      console.log('   ✓ confidence_level type updated to INTEGER');
    } else {
      console.log('   ✓ confidence_level is already INTEGER');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

migrate();
