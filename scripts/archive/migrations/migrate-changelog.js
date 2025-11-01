/**
 * Changelog Table Migration Script
 *
 * Creates the changelog table and backfills historical data
 *
 * Usage:
 *   node scripts/migrate-changelog.js [database-url]
 *
 * If no URL provided, uses DATABASE_URL from environment
 */

const { Pool } = require('pg');

const connectionUrl = process.argv[2] || process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error('❌ No database URL provided. Set DATABASE_URL or pass as argument.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionUrl,
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('\n🚀 Starting changelog migration...\n');

    // Step 1: Create changelog table
    console.log('1️⃣  Creating changelog table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS changelog (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255),
        entity_name VARCHAR(255),
        description TEXT,
        staff_member VARCHAR(255),
        staff_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✓ Changelog table created\n');

    // Step 2: Create indexes
    console.log('2️⃣  Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changelog_created_at ON changelog(created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changelog_category ON changelog(category);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changelog_staff_id ON changelog(staff_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_changelog_event_type ON changelog(event_type);
    `);
    console.log('   ✓ Indexes created\n');

    // Step 3: Check existing changelog entries
    const existingCount = await client.query('SELECT COUNT(*) as count FROM changelog');
    const count = parseInt(existingCount.rows[0].count);

    if (count > 0) {
      console.log(`⚠️  Found ${count} existing changelog entries. Skipping backfill.\n`);
    } else {
      console.log('3️⃣  Backfilling historical data...\n');

      // Backfill play_logs
      console.log('   📊 Backfilling play logs...');
      const playLogsResult = await client.query(`
        INSERT INTO changelog (event_type, category, entity_id, entity_name, description, staff_member, staff_id, created_at)
        SELECT
          'created' as event_type,
          'play_log' as category,
          pl.id::text as entity_id,
          g.name as entity_name,
          'Play session logged for ' || g.name as description,
          sl.staff_name as staff_member,
          pl.staff_list_id,
          pl.created_at
        FROM play_logs pl
        LEFT JOIN games g ON pl.game_id = g.id
        LEFT JOIN staff_list sl ON pl.staff_list_id = sl.stafflist_id
        WHERE pl.created_at IS NOT NULL
        ORDER BY pl.created_at ASC
      `);
      console.log(`   ✓ Backfilled ${playLogsResult.rowCount} play log entries\n`);

      // Backfill staff_knowledge
      console.log('   🧠 Backfilling staff knowledge...');
      const knowledgeResult = await client.query(`
        INSERT INTO changelog (event_type, category, entity_id, entity_name, description, staff_member, staff_id, metadata, created_at)
        SELECT
          'created' as event_type,
          'staff_knowledge' as category,
          sk.id::text as entity_id,
          g.name as entity_name,
          'Added knowledge: ' || g.name || ' - ' ||
          CASE sk.confidence_level
            WHEN 1 THEN 'Beginner'
            WHEN 2 THEN 'Intermediate'
            WHEN 3 THEN 'Expert'
            WHEN 4 THEN 'Instructor'
            ELSE 'Unknown'
          END || ' level' as description,
          sl.staff_name as staff_member,
          sk.staff_member_id as staff_id,
          jsonb_build_object(
            'confidenceLevel', sk.confidence_level,
            'canTeach', sk.can_teach
          ) as metadata,
          sk.created_at
        FROM staff_knowledge sk
        LEFT JOIN games g ON sk.game_id = g.id
        LEFT JOIN staff_list sl ON sk.staff_member_id = sl.stafflist_id
        WHERE sk.created_at IS NOT NULL
        ORDER BY sk.created_at ASC
      `);
      console.log(`   ✓ Backfilled ${knowledgeResult.rowCount} staff knowledge entries\n`);

      // Backfill content_checks
      console.log('   ✅ Backfilling content checks...');
      const checksResult = await client.query(`
        INSERT INTO changelog (event_type, category, entity_id, entity_name, description, staff_member, staff_id, metadata, created_at)
        SELECT
          'created' as event_type,
          'content_check' as category,
          cc.id::text as entity_id,
          g.name as entity_name,
          'Content check: ' || g.name || ' - ' || cc.status as description,
          sl.staff_name as staff_member,
          cc.inspector_id,
          jsonb_build_object(
            'status', cc.status,
            'notes', cc.notes
          ) as metadata,
          COALESCE(cc.check_date, cc.created_at) as created_at
        FROM content_checks cc
        LEFT JOIN games g ON cc.game_id = g.id
        LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
        WHERE (cc.check_date IS NOT NULL OR cc.created_at IS NOT NULL)
        ORDER BY COALESCE(cc.check_date, cc.created_at) ASC
      `);
      console.log(`   ✓ Backfilled ${checksResult.rowCount} content check entries\n`);

      // Get final count
      const finalCount = await client.query('SELECT COUNT(*) as count FROM changelog');
      const total = parseInt(finalCount.rows[0].count);
      console.log(`✅ Backfill complete! Total changelog entries: ${total}\n`);
    }

    console.log('🎉 Migration completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });