const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function addHasIssueAndResolutionColumns() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🚀 v1.2.0 Migration: Adding has_issue and resolution tracking columns...\n');

    // Step 1: Add has_issue column
    console.log('1️⃣  Adding has_issue BOOLEAN column...');
    await pool.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS has_issue BOOLEAN DEFAULT false NOT NULL;
    `);
    console.log('✅ has_issue column added\n');

    // Step 2: Add resolved_by_id column (foreign key to staff_list)
    console.log('2️⃣  Adding resolved_by_id UUID column...');
    await pool.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS resolved_by_id UUID REFERENCES staff_list(id);
    `);
    console.log('✅ resolved_by_id column added\n');

    // Step 3: Add resolved_from_check_id column (references another content check)
    console.log('3️⃣  Adding resolved_from_check_id TEXT column...');
    await pool.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS resolved_from_check_id TEXT REFERENCES content_checks(id);
    `);
    console.log('✅ resolved_from_check_id column added\n');

    // Step 4: Create indexes for performance
    console.log('4️⃣  Creating performance indexes...');

    // Index for filtering games with issues (partial index for efficiency)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_checks_has_issue
      ON content_checks(has_issue)
      WHERE has_issue = true;
    `);
    console.log('✅ Index created: idx_content_checks_has_issue');

    // Index for resolution tracking
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_content_checks_resolved_by
      ON content_checks(resolved_by_id)
      WHERE resolved_by_id IS NOT NULL;
    `);
    console.log('✅ Index created: idx_content_checks_resolved_by\n');

    // Step 5: Verify migration
    console.log('5️⃣  Verifying migration...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'content_checks'
        AND column_name IN ('has_issue', 'resolved_by_id', 'resolved_from_check_id')
      ORDER BY column_name;
    `);

    console.log('\n📊 New columns verification:');
    console.table(result.rows);

    // Step 6: Count existing checks (should all default to has_issue=false)
    const countResult = await pool.query(`
      SELECT
        COUNT(*) as total_checks,
        COUNT(*) FILTER (WHERE has_issue = false) as checks_without_issues,
        COUNT(*) FILTER (WHERE has_issue = true) as checks_with_issues
      FROM content_checks;
    `);

    console.log('\n📈 Content checks status:');
    console.table(countResult.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Notes:');
    console.log('  - All existing checks have has_issue = false (backward compatible)');
    console.log('  - New checks will set has_issue based on toggle in ContentCheckDialog');
    console.log('  - Resolution tracking fields are NULL for regular checks');
    console.log('  - Partial indexes created for performance (only indexes WHERE conditions are true)');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\n🔄 Rollback instructions:');
    console.error('  1. Run: ALTER TABLE content_checks DROP COLUMN IF EXISTS has_issue;');
    console.error('  2. Run: ALTER TABLE content_checks DROP COLUMN IF EXISTS resolved_by_id;');
    console.error('  3. Run: ALTER TABLE content_checks DROP COLUMN IF EXISTS resolved_from_check_id;');
    console.error('  4. Run: DROP INDEX IF EXISTS idx_content_checks_has_issue;');
    console.error('  5. Run: DROP INDEX IF EXISTS idx_content_checks_resolved_by;');
    throw error;
  } finally {
    await pool.end();
  }
}

addHasIssueAndResolutionColumns();
