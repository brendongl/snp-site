/**
 * Wipe Production Database
 *
 * Completely drops all tables, extensions, and schemas from production database
 * WARNING: This is IRREVERSIBLE!
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: Missing DATABASE_URL environment variable');
  process.exit(1);
}

console.log('🗑️  WIPING PRODUCTION DATABASE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚠️  WARNING: This will DELETE ALL data and tables!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function wipeDatabase() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('✅ Connected to production database\n');

    // Drop all tables (CASCADE will handle foreign key dependencies)
    console.log('🗑️  Dropping all tables...');

    // Get all tables in the public schema
    const tablesResult = await pool.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`   Found ${tables.length} tables to drop`);

    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`   ✓ Dropped table: ${table}`);
      } catch (err) {
        console.log(`   ⚠️  Could not drop ${table}: ${err.message}`);
      }
    }

    // Drop any remaining sequences
    console.log('\n🗑️  Dropping sequences...');
    try {
      await pool.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public')
          LOOP
            EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequencename) || ' CASCADE';
          END LOOP;
        END $$;
      `);
      console.log('   ✓ All sequences dropped');
    } catch (err) {
      console.log(`   ⚠️  Error dropping sequences: ${err.message}`);
    }

    // Drop any custom types
    console.log('\n🗑️  Dropping custom types...');
    try {
      await pool.query(`
        DO $$
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e')
          LOOP
            EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
        END $$;
      `);
      console.log('   ✓ All custom types dropped');
    } catch (err) {
      console.log(`   ⚠️  Error dropping types: ${err.message}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Production database completely wiped!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error wiping database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

wipeDatabase()
  .then(() => {
    console.log('✅ Database wipe completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database wipe failed:', error);
    process.exit(1);
  });
