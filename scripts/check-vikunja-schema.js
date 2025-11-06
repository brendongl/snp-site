/**
 * Check Vikunja database schema to find the correct table names
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkSchema() {
  console.log('🔍 Checking database schema for Vikunja tables...\n');

  try {
    // List all tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);
    console.log('📋 All tables in database:');
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Check for Vikunja-related tables
    const vikunjaTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (
          table_name LIKE '%task%'
          OR table_name LIKE '%label%'
          OR table_name LIKE '%project%'
        )
      ORDER BY table_name;
    `;

    const vikunjaResult = await pool.query(vikunjaTablesQuery);
    console.log('\n🎯 Vikunja-related tables:');
    vikunjaResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // If we find a tasks table, show its structure
    if (vikunjaResult.rows.some(row => row.table_name === 'tasks')) {
      console.log('\n📐 Structure of "tasks" table:');
      const columnsQuery = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        ORDER BY ordinal_position;
      `;
      const columnsResult = await pool.query(columnsQuery);
      columnsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkSchema().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
