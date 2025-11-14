/**
 * Combined Migration Script for Staging/Production
 *
 * Runs all pending migrations in sequence:
 * 1. Fix availability hours constraint (0-26)
 * 2. Delete Ivy from database
 *
 * Run this on staging after deployment:
 * railway run node scripts/run-staging-migrations.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  console.log('🚀 Starting staging migrations...\n');

  try {
    // ===================================================
    // Migration 1: Fix availability hours constraint
    // ===================================================
    console.log('📋 Migration 1: Fix availability hours constraint');
    console.log('   Problem: Database only allowed hours 0-23, but frontend needs 0-26 for overnight');

    // Drop old constraint
    await pool.query('ALTER TABLE staff_availability DROP CONSTRAINT IF EXISTS valid_hours');
    console.log('   ✅ Dropped old valid_hours constraint');

    // Add new constraint that allows extended hours (0-26 for 2am)
    await pool.query(`
      ALTER TABLE staff_availability
      ADD CONSTRAINT valid_hours
      CHECK ((hour_start >= 0) AND (hour_start <= 25) AND (hour_end >= 0) AND (hour_end <= 26))
    `);
    console.log('   ✅ Added new valid_hours constraint (0-26)');
    console.log('   Extended hours: 24=12am, 25=1am, 26=2am (end time)');
    console.log();

    // ===================================================
    // Migration 2: Delete Ivy
    // ===================================================
    console.log('📋 Migration 2: Delete Ivy from database');

    // Get Ivy's ID
    const ivyResult = await pool.query(
      "SELECT id, staff_name, nickname FROM staff_list WHERE nickname = 'Ivy'"
    );

    if (ivyResult.rows.length === 0) {
      console.log('   ℹ️  Ivy not found in database (already deleted or never existed)');
    } else {
      const ivy = ivyResult.rows[0];
      const ivyId = ivy.id;
      console.log(`   Found Ivy: ${ivy.staff_name} (ID: ${ivyId})`);

      // Delete related data (with correct column names for each table)
      const deleteOperations = [
        { table: 'staff_availability', field: 'staff_id' },
        { table: 'roster_shifts', field: 'staff_id' },
        { table: 'staff_knowledge', field: 'staff_member_id' },
        { table: 'play_logs', field: 'staff_list_id' },
        { table: 'content_checks', field: 'inspector_id' },
      ];

      const deletedCounts = {};

      for (const op of deleteOperations) {
        const result = await pool.query(
          `DELETE FROM ${op.table} WHERE ${op.field} = $1`,
          [ivyId]
        );
        deletedCounts[op.table] = result.rowCount || 0;
        if (result.rowCount > 0) {
          console.log(`   ✅ Deleted ${result.rowCount} records from ${op.table}`);
        }
      }

      // Delete Ivy from staff_list
      await pool.query('DELETE FROM staff_list WHERE id = $1', [ivyId]);
      console.log(`   ✅ Deleted Ivy from staff_list`);

      const totalRelated = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
      console.log(`   📊 Total: Deleted Ivy + ${totalRelated} related records`);
    }
    console.log();

    await pool.end();
    console.log('✨ All migrations completed successfully!');
    console.log();
    console.log('📌 Summary:');
    console.log('   ✅ Availability hours constraint fixed (now allows overnight hours)');
    console.log('   ✅ Ivy deleted from database');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
