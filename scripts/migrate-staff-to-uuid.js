/**
 * Migration Script: Consolidate Staff IDs to UUID
 *
 * This script migrates from the dual-ID system (staff_id + stafflist_id) to a single UUID system.
 *
 * Steps:
 * 1. Add UUID column to staff_list table
 * 2. Generate UUIDs for all existing staff
 * 3. Create migration mapping table
 * 4. Update foreign keys in content_checks, play_logs, staff_knowledge
 * 5. Drop old ID columns
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting staff ID to UUID migration...\n');

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Add UUID column to staff_list
    console.log('1️⃣  Adding UUID column to staff_list table...');
    await client.query(`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
    `);
    console.log('✅ UUID column added\n');

    // Step 2: Generate UUIDs for existing records (in case any don't have them)
    console.log('2️⃣  Generating UUIDs for existing staff records...');
    const updateResult = await client.query(`
      UPDATE staff_list
      SET id = gen_random_uuid()
      WHERE id IS NULL;
    `);
    console.log(`✅ Generated UUIDs for ${updateResult.rowCount} records\n`);

    // Step 3: Create migration mapping table
    console.log('3️⃣  Creating ID migration mapping table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_id_migration (
        uuid UUID PRIMARY KEY,
        old_staff_id VARCHAR(50),
        old_stafflist_id VARCHAR(50),
        migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO staff_id_migration (uuid, old_staff_id, old_stafflist_id)
      SELECT id, staff_id, stafflist_id
      FROM staff_list
      ON CONFLICT (uuid) DO NOTHING;
    `);

    const mappingCount = await client.query('SELECT COUNT(*) FROM staff_id_migration');
    console.log(`✅ Created mapping for ${mappingCount.rows[0].count} staff members\n`);

    // Step 4: Update foreign keys in content_checks
    console.log('4️⃣  Updating content_checks.inspector_id to UUID...');

    // Add temporary UUID column
    await client.query(`
      ALTER TABLE content_checks
      ADD COLUMN IF NOT EXISTS inspector_uuid UUID;
    `);

    // Populate with UUID based on old stafflist_id
    await client.query(`
      UPDATE content_checks cc
      SET inspector_uuid = m.uuid
      FROM staff_id_migration m
      WHERE cc.inspector_id = m.old_stafflist_id;
    `);

    // Check for unmapped records
    const unmappedChecks = await client.query(`
      SELECT COUNT(*) FROM content_checks
      WHERE inspector_uuid IS NULL AND inspector_id IS NOT NULL;
    `);

    if (parseInt(unmappedChecks.rows[0].count) > 0) {
      console.warn(`⚠️  Warning: ${unmappedChecks.rows[0].count} content checks have unmapped inspector IDs`);
    }

    // Drop old column and rename
    await client.query(`ALTER TABLE content_checks DROP COLUMN IF EXISTS inspector_id;`);
    await client.query(`ALTER TABLE content_checks RENAME COLUMN inspector_uuid TO inspector_id;`);

    const checksCount = await client.query('SELECT COUNT(*) FROM content_checks WHERE inspector_id IS NOT NULL');
    console.log(`✅ Updated ${checksCount.rows[0].count} content check records\n`);

    // Step 5: Update foreign keys in play_logs
    console.log('5️⃣  Updating play_logs.staff_list_id to UUID...');

    await client.query(`
      ALTER TABLE play_logs
      ADD COLUMN IF NOT EXISTS staff_uuid UUID;
    `);

    await client.query(`
      UPDATE play_logs pl
      SET staff_uuid = m.uuid
      FROM staff_id_migration m
      WHERE pl.staff_list_id = m.old_stafflist_id;
    `);

    const unmappedLogs = await client.query(`
      SELECT COUNT(*) FROM play_logs
      WHERE staff_uuid IS NULL AND staff_list_id IS NOT NULL;
    `);

    if (parseInt(unmappedLogs.rows[0].count) > 0) {
      console.warn(`⚠️  Warning: ${unmappedLogs.rows[0].count} play logs have unmapped staff IDs`);
    }

    await client.query(`ALTER TABLE play_logs DROP COLUMN IF EXISTS staff_list_id;`);
    await client.query(`ALTER TABLE play_logs RENAME COLUMN staff_uuid TO staff_list_id;`);

    const logsCount = await client.query('SELECT COUNT(*) FROM play_logs WHERE staff_list_id IS NOT NULL');
    console.log(`✅ Updated ${logsCount.rows[0].count} play log records\n`);

    // Step 6: Update foreign keys in staff_knowledge
    console.log('6️⃣  Updating staff_knowledge.staff_member_id to UUID...');

    await client.query(`
      ALTER TABLE staff_knowledge
      ADD COLUMN IF NOT EXISTS staff_uuid UUID;
    `);

    await client.query(`
      UPDATE staff_knowledge sk
      SET staff_uuid = m.uuid
      FROM staff_id_migration m
      WHERE sk.staff_member_id = m.old_stafflist_id;
    `);

    const unmappedKnowledge = await client.query(`
      SELECT COUNT(*) FROM staff_knowledge
      WHERE staff_uuid IS NULL AND staff_member_id IS NOT NULL;
    `);

    if (parseInt(unmappedKnowledge.rows[0].count) > 0) {
      console.warn(`⚠️  Warning: ${unmappedKnowledge.rows[0].count} staff knowledge records have unmapped staff IDs`);
    }

    await client.query(`ALTER TABLE staff_knowledge DROP COLUMN IF EXISTS staff_member_id;`);
    await client.query(`ALTER TABLE staff_knowledge RENAME COLUMN staff_uuid TO staff_member_id;`);

    const knowledgeCount = await client.query('SELECT COUNT(*) FROM staff_knowledge WHERE staff_member_id IS NOT NULL');
    console.log(`✅ Updated ${knowledgeCount.rows[0].count} staff knowledge records\n`);

    // Step 7: Update changelog table if it exists and has staff_id column
    console.log('7️⃣  Updating changelog.staff_id to UUID (if table exists)...');

    const changelogExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'changelog'
      );
    `);

    if (changelogExists.rows[0].exists) {
      await client.query(`
        ALTER TABLE changelog
        ADD COLUMN IF NOT EXISTS staff_uuid UUID;
      `);

      await client.query(`
        UPDATE changelog c
        SET staff_uuid = m.uuid
        FROM staff_id_migration m
        WHERE c.staff_id = m.old_stafflist_id OR c.staff_id = m.old_staff_id;
      `);

      await client.query(`ALTER TABLE changelog DROP COLUMN IF EXISTS staff_id;`);
      await client.query(`ALTER TABLE changelog RENAME COLUMN staff_uuid TO staff_id;`);

      console.log('✅ Updated changelog table\n');
    } else {
      console.log('ℹ️  Changelog table does not exist, skipping\n');
    }

    // Step 8: Update staff_list primary key
    console.log('8️⃣  Making UUID the primary key in staff_list...');

    // Drop old primary key
    await client.query(`
      ALTER TABLE staff_list
      DROP CONSTRAINT IF EXISTS staff_list_pkey;
    `);

    // Make UUID NOT NULL and set as primary key
    await client.query(`
      ALTER TABLE staff_list
      ALTER COLUMN id SET NOT NULL;
    `);

    await client.query(`
      ALTER TABLE staff_list
      ADD PRIMARY KEY (id);
    `);

    console.log('✅ UUID is now the primary key\n');

    // Step 9: Drop old ID columns from staff_list
    console.log('9️⃣  Dropping old staff_id and stafflist_id columns...');

    await client.query(`
      ALTER TABLE staff_list
      DROP COLUMN IF EXISTS staff_id,
      DROP COLUMN IF EXISTS stafflist_id;
    `);

    console.log('✅ Old ID columns removed\n');

    // Commit transaction
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - ${mappingCount.rows[0].count} staff members migrated to UUID`);
    console.log(`   - ${checksCount.rows[0].count} content checks updated`);
    console.log(`   - ${logsCount.rows[0].count} play logs updated`);
    console.log(`   - ${knowledgeCount.rows[0].count} staff knowledge records updated`);
    console.log('\n🎉 Migration complete! The dual-ID system has been replaced with single UUID system.');

  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('\n🔄 All changes have been rolled back.');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
