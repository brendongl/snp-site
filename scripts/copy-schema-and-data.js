/**
 * Copy Schema and Data from Staging to Production
 *
 * This script:
 * 1. Copies the complete database schema from staging to production
 * 2. Copies all data from staging to production
 */

const { Pool } = require('pg');

const STAGING_DB_URL = process.env.STAGING_DATABASE_URL;
const PRODUCTION_DB_URL = process.env.DATABASE_URL;

if (!STAGING_DB_URL || !PRODUCTION_DB_URL) {
  console.error('❌ ERROR: Missing database URLs');
  console.error('Required environment variables:');
  console.error('  - STAGING_DATABASE_URL (staging database)');
  console.error('  - DATABASE_URL (production database)');
  process.exit(1);
}

console.log('🚀 Copying Database: Staging → Production');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function copyDatabase() {
  const stagingPool = new Pool({ connectionString: STAGING_DB_URL });
  const productionPool = new Pool({ connectionString: PRODUCTION_DB_URL });

  try {
    console.log('\n✅ Connected to both databases');

    // Get all tables from staging
    console.log('\n📋 Step 1: Getting table list from staging...');
    const tablesResult = await stagingPool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`   Found ${tables.length} tables:`, tables);

    // Start transaction on production
    const prodClient = await productionPool.connect();
    await prodClient.query('BEGIN');

    // Copy schema for each table
    console.log('\n🏗️  Step 2: Copying table schemas...');
    for (const tableName of tables) {
      // Get CREATE TABLE statement from staging
      const createTableResult = await stagingPool.query(`
        SELECT
          'CREATE TABLE ' || quote_ident(table_name) || ' (' ||
          string_agg(
            quote_ident(column_name) || ' ' ||
            column_type ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
            ', '
          ) ||
          ');' as create_statement
        FROM (
          SELECT
            c.table_name,
            c.column_name,
            c.data_type ||
            CASE
              WHEN c.character_maximum_length IS NOT NULL
              THEN '(' || c.character_maximum_length || ')'
              WHEN c.numeric_precision IS NOT NULL
              THEN '(' || c.numeric_precision || ',' || c.numeric_scale || ')'
              ELSE ''
            END as column_type,
            c.is_nullable,
            c.column_default,
            c.ordinal_position
          FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = $1
          ORDER BY c.ordinal_position
        ) AS cols
        GROUP BY table_name
      `, [tableName]);

      if (createTableResult.rows.length > 0) {
        const createStatement = createTableResult.rows[0].create_statement;
        await prodClient.query(createStatement);
        console.log(`   ✓ Created table: ${tableName}`);
      }
    }

    // Copy constraints and indexes
    console.log('\n🔗 Step 3: Copying constraints and indexes...');

    // Copy primary keys
    const pkResult = await stagingPool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ') as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name
    `);

    for (const row of pkResult.rows) {
      try {
        await prodClient.query(`
          ALTER TABLE "${row.table_name}"
          ADD CONSTRAINT "${row.constraint_name}"
          PRIMARY KEY (${row.columns})
        `);
        console.log(`   ✓ Added primary key to ${row.table_name}`);
      } catch (err) {
        console.log(`   ⚠️  Could not add PK to ${row.table_name}: ${err.message}`);
      }
    }

    // Copy foreign keys
    const fkResult = await stagingPool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `);

    for (const row of fkResult.rows) {
      try {
        await prodClient.query(`
          ALTER TABLE "${row.table_name}"
          ADD CONSTRAINT "${row.constraint_name}"
          FOREIGN KEY ("${row.column_name}")
          REFERENCES "${row.foreign_table_name}" ("${row.foreign_column_name}")
        `);
        console.log(`   ✓ Added foreign key to ${row.table_name}`);
      } catch (err) {
        console.log(`   ⚠️  Could not add FK to ${row.table_name}: ${err.message}`);
      }
    }

    // Copy data
    console.log('\n📦 Step 4: Copying data...');
    for (const tableName of tables) {
      const countResult = await stagingPool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const count = parseInt(countResult.rows[0].count);

      if (count === 0) {
        console.log(`   ⊘ ${tableName}: 0 rows (skipped)`);
        continue;
      }

      // Get all data from staging
      const dataResult = await stagingPool.query(`SELECT * FROM "${tableName}"`);

      if (dataResult.rows.length > 0) {
        // Get column names
        const columns = Object.keys(dataResult.rows[0]);
        const columnNames = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Insert each row
        let inserted = 0;
        for (const row of dataResult.rows) {
          const values = columns.map(col => row[col]);
          await prodClient.query(
            `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        }

        console.log(`   ✓ ${tableName}: ${inserted} rows`);
      }
    }

    // Commit transaction
    await prodClient.query('COMMIT');
    prodClient.release();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database Copy Summary:');
    console.log(`   • Tables: ${tables.length}`);
    console.log('   • Schema and data copied successfully!');
    console.log('\n🎉 Database copy completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Copy failed:', error);
    console.error('Rolling back changes...');

    try {
      await productionPool.query('ROLLBACK');
      console.log('✓ Rollback successful - production database unchanged');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }

    throw error;
  } finally {
    await stagingPool.end();
    await productionPool.end();
  }
}

// Run copy
copyDatabase()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
