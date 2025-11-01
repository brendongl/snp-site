const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkPlayLogsData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('\n=== Checking Play Logs Data ===\n');

    // Total play logs
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM play_logs');
    console.log(`Total play logs: ${totalResult.rows[0].total}`);

    // Last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysResult = await pool.query(
      'SELECT COUNT(*) as count FROM play_logs WHERE session_date >= $1',
      [sevenDaysAgo.toISOString().split('T')[0]]
    );
    console.log(`Play logs in last 7 days: ${sevenDaysResult.rows[0].count}`);

    // Last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysResult = await pool.query(
      'SELECT COUNT(*) as count FROM play_logs WHERE session_date >= $1',
      [thirtyDaysAgo.toISOString().split('T')[0]]
    );
    console.log(`Play logs in last 30 days: ${thirtyDaysResult.rows[0].count}`);

    // Recent play logs sample
    console.log('\nRecent play logs (last 10):');
    const recentResult = await pool.query(`
      SELECT
        pl.session_date,
        g.name as game_name,
        sl.staff_name
      FROM play_logs pl
      LEFT JOIN games g ON pl.game_id = g.id
      LEFT JOIN staff_list sl ON pl.staff_list_id = sl.stafflist_id
      ORDER BY pl.session_date DESC
      LIMIT 10
    `);
    recentResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.session_date} - ${row.game_name} (by ${row.staff_name})`);
    });

    // Check if session_date is actually a date field
    console.log('\nChecking session_date data types:');
    const sampleResult = await pool.query(`
      SELECT session_date, created_at
      FROM play_logs
      ORDER BY created_at DESC
      LIMIT 5
    `);
    sampleResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. session_date: ${row.session_date} (type: ${typeof row.session_date})`);
      console.log(`      created_at: ${row.created_at}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPlayLogsData();
