/**
 * Create points_config table for configurable point values
 * Part of v1.5.3 - Points Configuration Dashboard
 *
 * Run: node scripts/create-points-config-table.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createPointsConfigTable() {
  const client = await pool.connect();

  try {
    console.log('🔧 Creating points_config table...');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS points_config (
        id SERIAL PRIMARY KEY,
        action_type VARCHAR(50) UNIQUE NOT NULL,
        base_points INTEGER NOT NULL,
        uses_complexity BOOLEAN DEFAULT false,
        uses_level_multiplier BOOLEAN DEFAULT false,
        uses_student_count BOOLEAN DEFAULT false,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by_id UUID REFERENCES staff_list(id)
      );
    `);
    console.log('✅ points_config table created');

    // Insert initial data
    console.log('🔧 Inserting initial point configurations...');

    await client.query(`
      INSERT INTO points_config (action_type, base_points, uses_complexity, description) VALUES
        ('play_log', 100, false, 'Points for logging a play session'),
        ('content_check', 1000, true, 'Points for completing content check (× complexity)'),
        ('knowledge_add_level_1', 100, true, 'Beginner level knowledge (× complexity)'),
        ('knowledge_add_level_2', 200, true, 'Intermediate level knowledge (× complexity)'),
        ('knowledge_add_level_3', 300, true, 'Expert level knowledge (× complexity)'),
        ('knowledge_add_level_4', 500, true, 'Instructor level knowledge (× complexity)'),
        ('knowledge_upgrade', 100, true, 'Upgrading knowledge level (× complexity)'),
        ('teaching', 1000, true, 'Teaching session (× complexity × students)'),
        ('photo_upload', 1000, false, 'Uploading game photo'),
        ('issue_report', 100, false, 'Reporting any issue'),
        ('issue_resolution_basic', 500, false, 'Resolving basic issue'),
        ('issue_resolution_complex', 1000, false, 'Resolving complex issue (complexity ≥ 3)')
      ON CONFLICT (action_type) DO NOTHING;
    `);
    console.log('✅ Initial configurations inserted');

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_points_config_action_type
        ON points_config(action_type);
    `);
    console.log('✅ Index created: idx_points_config_action_type');

    // Verify table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'points_config'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

    // Show inserted data
    const dataResult = await client.query(`
      SELECT action_type, base_points, uses_complexity, description
      FROM points_config
      ORDER BY action_type;
    `);

    console.log('\n📊 Initial point configurations:');
    dataResult.rows.forEach(row => {
      const multiplier = row.uses_complexity ? ' (× complexity)' : '';
      console.log(`  - ${row.action_type}: ${row.base_points} points${multiplier}`);
    });

    console.log('\n✅ points_config table setup complete!');

  } catch (error) {
    console.error('❌ Error creating points_config table:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createPointsConfigTable().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}

module.exports = { createPointsConfigTable };
