/**
 * Create PostgreSQL sequence for changelog table IDs
 *
 * Fixes race condition where multiple concurrent inserts
 * try to use the same ID (MAX + 1), causing PRIMARY KEY violations.
 *
 * Solution: Use PostgreSQL sequence with NEXTVAL for atomic ID generation.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createChangelogSequence() {
  try {
    console.log('🔧 Creating changelog sequence...');

    // Get current max ID
    const maxIdResult = await pool.query('SELECT COALESCE(MAX(id), 0) as max_id FROM changelog');
    const maxId = maxIdResult.rows[0].max_id;
    console.log(`   Current MAX(id) = ${maxId}`);

    // Create sequence starting from max_id + 1
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS changelog_id_seq
      START WITH ${maxId + 1}
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1;
    `);

    console.log(`✅ Sequence created: changelog_id_seq (starts at ${maxId + 1})`);

    // Test the sequence
    const testResult = await pool.query('SELECT nextval(\'changelog_id_seq\') as next_id');
    const nextId = testResult.rows[0].next_id;
    console.log(`   Test: NEXTVAL returned ${nextId}`);

    // Reset sequence to correct value (since we just consumed one)
    await pool.query(`SELECT setval('changelog_id_seq', ${maxId + 1}, false)`);
    console.log(`   Reset sequence to ${maxId + 1}`);

    console.log('');
    console.log('✅ Changelog sequence ready!');
    console.log('   Next changelog ID will be:', maxId + 1);
    console.log('');
    console.log('📝 Update points-service.ts to use:');
    console.log('   const result = await pool.query("SELECT nextval(\'changelog_id_seq\') as next_id");');
    console.log('   const changelogId = result.rows[0].next_id;');

  } catch (error) {
    console.error('❌ Error creating sequence:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createChangelogSequence();
