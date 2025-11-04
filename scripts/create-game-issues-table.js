/**
 * Create game_issues table for tracking actionable and non-actionable issues
 * Part of v1.5.0 - Issue Reporting & Points System
 *
 * Run: node scripts/create-game-issues-table.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createGameIssuesTable() {
  const client = await pool.connect();

  try {
    console.log('🔧 Creating game_issues table...');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_issues (
        id VARCHAR(50) PRIMARY KEY,
        game_id VARCHAR(50) NOT NULL,
        reported_by_id UUID NOT NULL,
        issue_category VARCHAR(50) NOT NULL,
        issue_type VARCHAR(20) NOT NULL CHECK (issue_type IN ('actionable', 'non_actionable')),
        description TEXT,
        vikunja_task_id INTEGER,
        resolved_at TIMESTAMP,
        resolved_by_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Foreign keys
        CONSTRAINT fk_game_issues_game
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        CONSTRAINT fk_game_issues_reported_by
          FOREIGN KEY (reported_by_id) REFERENCES staff_list(id),
        CONSTRAINT fk_game_issues_resolved_by
          FOREIGN KEY (resolved_by_id) REFERENCES staff_list(id)
      );
    `);
    console.log('✅ game_issues table created');

    // Create indexes
    console.log('🔧 Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_issues_game_id
        ON game_issues(game_id);
    `);
    console.log('✅ Index created: idx_game_issues_game_id');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_issues_category
        ON game_issues(issue_category);
    `);
    console.log('✅ Index created: idx_game_issues_category');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_issues_unresolved
        ON game_issues(issue_type) WHERE resolved_at IS NULL;
    `);
    console.log('✅ Index created: idx_game_issues_unresolved (partial)');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_game_issues_vikunja
        ON game_issues(vikunja_task_id) WHERE vikunja_task_id IS NOT NULL;
    `);
    console.log('✅ Index created: idx_game_issues_vikunja (partial)');

    // Verify table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'game_issues'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'game_issues';
    `);

    console.log('\n🔑 Indexes:');
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });

    console.log('\n✅ game_issues table setup complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Run: node scripts/add-points-tracking-to-changelog.js');
    console.log('  2. Create Vikunja "Board Game Issues" project');
    console.log('  3. Set VIKUNJA_BG_ISSUES_PROJECT_ID environment variable');

  } catch (error) {
    console.error('❌ Error creating game_issues table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createGameIssuesTable().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}

module.exports = { createGameIssuesTable };
