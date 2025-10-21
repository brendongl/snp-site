const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 Staff Table Migration Script');
console.log('================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function migrateTable() {
  const client = await pool.connect();
  try {
    // Step 1: Check if stafflist_id column already exists
    console.log('\n1️⃣  Checking if migration is needed...');
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'staff_list' AND column_name = 'stafflist_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log('   ✓ stafflist_id column already exists - migration already applied');
      return;
    }

    // Step 2: Add stafflist_id column
    console.log('\n2️⃣  Adding stafflist_id column...');
    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN stafflist_id VARCHAR(50);
    `);
    console.log('   ✓ Column added');

    // Step 3: Make staff_email NOT NULL (if it isn't already)
    console.log('\n3️⃣  Updating email column constraints...');
    await client.query(`
      ALTER TABLE staff_list
      ALTER COLUMN staff_email SET NOT NULL;
    `).catch((err) => {
      // Column might already be NOT NULL, that's fine
      if (!err.message.includes('already')) {
        throw err;
      }
      console.log('   ℹ  staff_email already NOT NULL');
    });
    console.log('   ✓ Email column updated');

    // Step 4: Create index on stafflist_id
    console.log('\n4️⃣  Creating index on stafflist_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stafflist_id ON staff_list(stafflist_id);
    `);
    console.log('   ✓ Index created');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Deploy code changes');
    console.log('2. Run: curl -X POST https://snp-site-staging.up.railway.app/api/staff-list/sync');
    console.log('3. Verify staff_list table has stafflist_id values populated');
    console.log('4. Test login and Play Logs flow\n');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

migrateTable();
