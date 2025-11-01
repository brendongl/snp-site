/**
 * Check staff_knowledge data and join relationships on staging database
 */

const { Pool } = require('pg');

const STAGING_DATABASE_URL = 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function checkKnowledgeData() {
  const pool = new Pool({
    connectionString: STAGING_DATABASE_URL,
    ssl: false
  });

  try {
    console.log('\n🔍 Checking staff_knowledge data on STAGING database...\n');

    // Check total staff_knowledge records
    const totalResult = await pool.query('SELECT COUNT(*) as count FROM staff_knowledge');
    console.log(`📊 Total staff_knowledge records: ${totalResult.rows[0].count}`);

    // Check sample data with staff names
    console.log('\n📋 Sample staff_knowledge records (first 10):');
    const sampleResult = await pool.query(`
      SELECT
        sk.id,
        sk.staff_member_id,
        sk.game_id,
        sk.confidence_level,
        sk.can_teach,
        sl.staff_name,
        sl.staff_id as staff_list_staff_id
      FROM staff_knowledge sk
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.staff_id
      ORDER BY sk.id
      LIMIT 10
    `);

    sampleResult.rows.forEach(row => {
      console.log(`  - ID: ${row.id}`);
      console.log(`    staff_member_id: ${row.staff_member_id}`);
      console.log(`    staff_list.staff_id: ${row.staff_list_staff_id || 'NOT FOUND'}`);
      console.log(`    staff_name: ${row.staff_name || 'NO MATCH'}`);
      console.log(`    game_id: ${row.game_id}`);
      console.log(`    confidence: ${row.confidence_level}, can_teach: ${row.can_teach}`);
      console.log('');
    });

    // Check if any staff_knowledge records match staff_list
    const matchResult = await pool.query(`
      SELECT
        COUNT(*) as total_knowledge,
        COUNT(DISTINCT sk.staff_member_id) as unique_staff_in_knowledge,
        COUNT(DISTINCT sl.staff_id) as matched_staff
      FROM staff_knowledge sk
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.staff_id
    `);

    console.log('\n📊 Join Analysis:');
    console.log(`  Total knowledge records: ${matchResult.rows[0].total_knowledge}`);
    console.log(`  Unique staff in knowledge: ${matchResult.rows[0].unique_staff_in_knowledge}`);
    console.log(`  Matched with staff_list: ${matchResult.rows[0].matched_staff}`);

    // Check staff_list staff_id values
    console.log('\n📋 Staff_list staff_id values (first 10):');
    const staffResult = await pool.query(`
      SELECT staff_id, staff_name, stafflist_id
      FROM staff_list
      ORDER BY staff_name
      LIMIT 10
    `);

    staffResult.rows.forEach(row => {
      console.log(`  - ${row.staff_name}: staff_id="${row.staff_id}", stafflist_id="${row.stafflist_id}"`);
    });

    // Check for Brendon specifically
    console.log('\n🔍 Checking your account (brendonganle@gmail.com):');
    const brendonResult = await pool.query(`
      SELECT
        sl.staff_id,
        sl.staff_name,
        sl.staff_email,
        COUNT(sk.id) as knowledge_count
      FROM staff_list sl
      LEFT JOIN staff_knowledge sk ON sk.staff_member_id = sl.staff_id
      WHERE sl.staff_email = 'brendonganle@gmail.com'
      GROUP BY sl.staff_id, sl.staff_name, sl.staff_email
    `);

    if (brendonResult.rows.length > 0) {
      const brendon = brendonResult.rows[0];
      console.log(`  ✅ Found: ${brendon.staff_name}`);
      console.log(`  staff_id: ${brendon.staff_id}`);
      console.log(`  Knowledge count: ${brendon.knowledge_count}`);
    } else {
      console.log(`  ❌ Not found in database`);
    }

    // Check distinct staff_member_id values in staff_knowledge
    console.log('\n📋 Distinct staff_member_id in staff_knowledge (first 10):');
    const distinctStaffResult = await pool.query(`
      SELECT DISTINCT staff_member_id, COUNT(*) as count
      FROM staff_knowledge
      GROUP BY staff_member_id
      ORDER BY count DESC
      LIMIT 10
    `);

    distinctStaffResult.rows.forEach(row => {
      console.log(`  - staff_member_id: "${row.staff_member_id}" (${row.count} games)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkKnowledgeData().catch(console.error);
