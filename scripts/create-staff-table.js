const { Pool } = require('pg');

// Get connection URL from command line argument or environment variable
const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('📦 Database Setup Script');
console.log('=======================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

async function createTables() {
  const client = await pool.connect();
  try {
    // Create staff_list table
    console.log('\n1️⃣  Creating staff_list table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_list (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_name VARCHAR(255) NOT NULL,
        staff_email VARCHAR(255) NOT NULL UNIQUE,
        staff_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✓ Table created (UUID primary key)');

    console.log('   Creating index on staff_name...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_name ON staff_list(staff_name);
    `);
    console.log('   ✓ Index created');

    console.log('   Creating index on staff_email...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_email ON staff_list(staff_email);
    `);
    console.log('   ✓ Email index created');

    console.log('   Adding table comment...');
    await client.query(`
      COMMENT ON TABLE staff_list IS 'Staff members with PostgreSQL-native UUID primary keys. Synced from Airtable via POST /api/staff-list/sync';
    `);
    console.log('   ✓ Table comment added\n');

    // Create play_log_cache table
    console.log('2️⃣  Creating play_log_cache table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS play_log_cache (
        game_id VARCHAR(50) PRIMARY KEY,
        staff_name VARCHAR(255) NOT NULL,
        logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✓ Table created');

    console.log('   Creating index on logged_at...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_logged_at ON play_log_cache(logged_at);
    `);
    console.log('   ✓ Index created');

    console.log('   Adding table comment...');
    await client.query(`
      COMMENT ON TABLE play_log_cache IS 'Cache of recent play logs (1 hour TTL). Auto-cleaned by periodic jobs.';
    `);
    console.log('   ✓ Table comment added\n');

    console.log('✅ Successfully created all database tables!');
    console.log('\n📊 Tables created:');
    console.log('   • staff_list (staff member cache)');
    console.log('   • play_log_cache (play session logs)\n');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

createTables();
