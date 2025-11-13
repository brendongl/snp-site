/**
 * Migration Script: Add Draft/Publish Workflow Columns
 * Version: 1.10.0
 * Phase 3.2: Draft/Publish Feature
 *
 * Adds columns to support draft/publish workflow:
 * - roster_metadata: status, published_at, published_by
 * - roster_shifts: is_published, published_at, edited_after_publish
 *
 * Run: node scripts/add-draft-publish-columns.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function addDraftPublishColumns() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting draft/publish workflow migration...\n');

    // Start transaction
    await client.query('BEGIN');

    // ========================================
    // 1. Modify roster_metadata table
    // ========================================
    console.log('📝 Step 1: Adding columns to roster_metadata...');

    await client.query(`
      ALTER TABLE roster_metadata
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES staff_list(id)
    `);

    console.log('   ✅ Added: status, published_at, published_by\n');

    // ========================================
    // 2. Modify roster_shifts table
    // ========================================
    console.log('📝 Step 2: Adding columns to roster_shifts...');

    await client.query(`
      ALTER TABLE roster_shifts
      ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS edited_after_publish BOOLEAN DEFAULT false
    `);

    console.log('   ✅ Added: is_published, published_at, edited_after_publish\n');

    // ========================================
    // 3. Create index for faster queries
    // ========================================
    console.log('📝 Step 3: Creating performance indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_metadata_status ON roster_metadata(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roster_shifts_published ON roster_shifts(is_published, edited_after_publish)
    `);

    console.log('   ✅ Created indexes for status and publish queries\n');

    // Commit transaction
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log('  - roster_metadata: 3 new columns (status, published_at, published_by)');
    console.log('  - roster_shifts: 3 new columns (is_published, published_at, edited_after_publish)');
    console.log('  - 2 new indexes for query performance\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
addDraftPublishColumns().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
