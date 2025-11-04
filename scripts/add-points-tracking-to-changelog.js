/**
 * Add points tracking columns to changelog table
 * Part of v1.5.0 - Issue Reporting & Points System
 *
 * Adds:
 * - points_awarded: INTEGER (amount of points awarded for this action)
 * - point_category: VARCHAR(50) (type of action: play_log, content_check, etc.)
 *
 * Run: node scripts/add-points-tracking-to-changelog.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function addPointsTrackingToChangelog() {
  const client = await pool.connect();

  try {
    console.log('🔧 Adding points tracking columns to changelog table...');

    // Add points_awarded column
    await client.query(`
      ALTER TABLE changelog
      ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;
    `);
    console.log('✅ Added column: points_awarded');

    // Add point_category column
    await client.query(`
      ALTER TABLE changelog
      ADD COLUMN IF NOT EXISTS point_category VARCHAR(50);
    `);
    console.log('✅ Added column: point_category');

    // Create index on point_category for fast filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changelog_point_category
        ON changelog(point_category) WHERE point_category IS NOT NULL;
    `);
    console.log('✅ Index created: idx_changelog_point_category');

    // Verify columns added
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'changelog'
        AND column_name IN ('points_awarded', 'point_category')
      ORDER BY column_name;
    `);

    console.log('\n📋 New columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'NULL'})`);
    });

    // Show point categories that will be used
    console.log('\n📊 Point categories:');
    const categories = [
      'play_log - 100 points',
      'content_check - 1000 × complexity',
      'knowledge_add - level × complexity (100-500)',
      'knowledge_upgrade - 100 × complexity',
      'teaching - 1000 × complexity × students',
      'photo_upload - 1000 points',
      'issue_report - 100 points',
      'issue_resolution - 500-1000 (×2 if complexity ≥ 3)'
    ];
    categories.forEach(cat => console.log(`  - ${cat}`));

    console.log('\n✅ Changelog table updated successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Create Vikunja "Board Game Issues" project');
    console.log('  2. Set VIKUNJA_BG_ISSUES_PROJECT_ID environment variable');
    console.log('  3. Implement PointsService (lib/services/points-service.ts)');

  } catch (error) {
    console.error('❌ Error adding points tracking to changelog:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  addPointsTrackingToChangelog().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}

module.exports = { addPointsTrackingToChangelog };
