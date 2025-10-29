/**
 * Fix can_teach inconsistency in staff_knowledge table
 *
 * Business rule: Only Expert (3) and Instructor (4) can teach
 * This script fixes records where:
 * - Beginner (1) or Intermediate (2) has can_teach = true
 * - Expert (3) or Instructor (4) has can_teach = false
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function fixCanTeachInconsistency() {
  console.log('🔍 Checking for can_teach inconsistencies...\n');

  try {
    // Find records where can_teach doesn't match confidence_level
    const inconsistentRecords = await pool.query(`
      SELECT
        id,
        staff_member_id,
        confidence_level,
        can_teach,
        CASE
          WHEN confidence_level IN (3, 4) THEN true
          ELSE false
        END as expected_can_teach
      FROM staff_knowledge
      WHERE (
        -- Beginner/Intermediate with can_teach = true
        (confidence_level IN (1, 2) AND can_teach = true)
        OR
        -- Expert/Instructor with can_teach = false
        (confidence_level IN (3, 4) AND can_teach = false)
      )
      ORDER BY staff_member_id, confidence_level
    `);

    console.log(`Found ${inconsistentRecords.rows.length} inconsistent records:\n`);

    if (inconsistentRecords.rows.length === 0) {
      console.log('✅ No inconsistencies found! Database is clean.');
      await pool.end();
      return;
    }

    // Group by issue type
    const wronglyCanTeach = inconsistentRecords.rows.filter(r => r.confidence_level <= 2 && r.can_teach);
    const wronglyCantTeach = inconsistentRecords.rows.filter(r => r.confidence_level >= 3 && !r.can_teach);

    console.log(`  - ${wronglyCanTeach.length} Beginner/Intermediate records with can_teach = true`);
    console.log(`  - ${wronglyCantTeach.length} Expert/Instructor records with can_teach = false\n`);

    // Show sample records
    console.log('Sample inconsistent records:');
    inconsistentRecords.rows.slice(0, 5).forEach(r => {
      const levelName = ['', 'Beginner', 'Intermediate', 'Expert', 'Instructor'][r.confidence_level];
      console.log(`  - ${r.id}: ${levelName} (${r.confidence_level}) with can_teach = ${r.can_teach} (should be ${r.expected_can_teach})`);
    });

    console.log('\n⚠️  This will update can_teach to match confidence_level for all inconsistent records.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Fix the inconsistencies
    console.log('🔧 Fixing inconsistencies...\n');

    const updateResult = await pool.query(`
      UPDATE staff_knowledge
      SET
        can_teach = CASE
          WHEN confidence_level IN (3, 4) THEN true
          ELSE false
        END,
        updated_at = NOW()
      WHERE (
        (confidence_level IN (1, 2) AND can_teach = true)
        OR
        (confidence_level IN (3, 4) AND can_teach = false)
      )
      RETURNING id, confidence_level, can_teach
    `);

    console.log(`✅ Fixed ${updateResult.rows.length} records!\n`);

    // Verify the fix
    const remainingIssues = await pool.query(`
      SELECT COUNT(*) as count
      FROM staff_knowledge
      WHERE (
        (confidence_level IN (1, 2) AND can_teach = true)
        OR
        (confidence_level IN (3, 4) AND can_teach = false)
      )
    `);

    if (remainingIssues.rows[0].count === '0') {
      console.log('✅ Verification passed! All records are now consistent.');
    } else {
      console.log(`⚠️  Warning: ${remainingIssues.rows[0].count} inconsistent records still remain.`);
    }

  } catch (error) {
    console.error('❌ Error fixing inconsistencies:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixCanTeachInconsistency();
