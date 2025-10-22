/**
 * Database Migration Script: Staging → Production
 *
 * This script copies ALL data from staging database to production database:
 * - games
 * - game_images
 * - content_checks
 * - staff_list
 * - play_logs
 * - staff_knowledge
 *
 * WARNING: This will COMPLETELY OVERWRITE production database!
 */

const { Pool } = require('pg');

// Database connection strings
const STAGING_DB_URL = process.env.STAGING_DATABASE_URL;
const PRODUCTION_DB_URL = process.env.DATABASE_URL;

if (!STAGING_DB_URL || !PRODUCTION_DB_URL) {
  console.error('❌ ERROR: Missing database URLs');
  console.error('Required environment variables:');
  console.error('  - STAGING_DATABASE_URL (staging database)');
  console.error('  - DATABASE_URL (production database)');
  process.exit(1);
}

console.log('🚀 Starting Staging → Production Database Migration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

async function migrateData() {
  const stagingPool = new Pool({ connectionString: STAGING_DB_URL });
  const productionPool = new Pool({ connectionString: PRODUCTION_DB_URL });

  try {
    console.log('\n✅ Connected to both databases');

    // Start transaction on production
    const prodClient = await productionPool.connect();
    await prodClient.query('BEGIN');

    console.log('\n🗑️  Step 1: Clearing production database...');

    // Drop all existing data (in correct order due to foreign keys)
    await prodClient.query('DELETE FROM staff_knowledge');
    await prodClient.query('DELETE FROM play_logs');
    await prodClient.query('DELETE FROM content_checks');
    await prodClient.query('DELETE FROM game_images');
    await prodClient.query('DELETE FROM games');
    await prodClient.query('DELETE FROM staff_list');

    console.log('   ✓ Production database cleared');

    // Migrate staff_list first (referenced by other tables)
    console.log('\n📋 Step 2: Migrating staff_list...');
    const staffResult = await stagingPool.query('SELECT * FROM staff_list');
    let staffCount = 0;
    for (const row of staffResult.rows) {
      await prodClient.query(
        `INSERT INTO staff_list (staff_id, stafflist_id, staff_name, staff_email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.stafflist_id, row.stafflist_id, row.staff_name, row.staff_email, row.created_at, row.updated_at]
      );
      staffCount++;
    }
    console.log(`   ✓ Migrated ${staffCount} staff records`);

    // Migrate games
    console.log('\n🎮 Step 3: Migrating games...');
    const gamesResult = await stagingPool.query('SELECT * FROM games');
    let gamesCount = 0;
    for (const row of gamesResult.rows) {
      await prodClient.query(
        `INSERT INTO games (
          id, name, description, categories, year_released, complexity,
          min_players, max_players, best_player_amount, date_of_acquisition,
          latest_check_date, latest_check_status, latest_check_notes, total_checks,
          sleeved, box_wrapped, is_expansion, base_game_id, game_expansions_link,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [
          row.id, row.name, row.description, row.categories, row.year_released,
          row.complexity, row.min_players, row.max_players, row.best_player_amount,
          row.date_of_acquisition, row.latest_check_date, row.latest_check_status,
          row.latest_check_notes, row.total_checks, row.sleeved, row.box_wrapped,
          row.is_expansion, row.base_game_id, row.game_expansions_link,
          row.created_at, row.updated_at
        ]
      );
      gamesCount++;
    }
    console.log(`   ✓ Migrated ${gamesCount} games`);

    // Migrate game_images
    console.log('\n🖼️  Step 4: Migrating game_images...');
    const imagesResult = await stagingPool.query('SELECT * FROM game_images');
    let imagesCount = 0;
    for (const row of imagesResult.rows) {
      await prodClient.query(
        `INSERT INTO game_images (id, game_id, hash, file_name, url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.game_id, row.hash, row.file_name, row.url, row.created_at]
      );
      imagesCount++;
    }
    console.log(`   ✓ Migrated ${imagesCount} image records`);

    // Migrate content_checks
    console.log('\n✅ Step 5: Migrating content_checks...');
    const checksResult = await stagingPool.query('SELECT * FROM content_checks');
    let checksCount = 0;
    for (const row of checksResult.rows) {
      await prodClient.query(
        `INSERT INTO content_checks (
          id, game_id, check_date, inspector_id, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check,
          box_wrapped_at_check, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          row.id, row.game_id, row.check_date, row.inspector_id, row.status,
          row.missing_pieces, row.box_condition, row.card_condition, row.is_fake,
          row.notes, row.sleeved_at_check, row.box_wrapped_at_check,
          row.created_at, row.updated_at
        ]
      );
      checksCount++;
    }
    console.log(`   ✓ Migrated ${checksCount} content checks`);

    // Migrate play_logs
    console.log('\n🎲 Step 6: Migrating play_logs...');
    const logsResult = await stagingPool.query('SELECT * FROM play_logs');
    let logsCount = 0;
    for (const row of logsResult.rows) {
      await prodClient.query(
        `INSERT INTO play_logs (
          id, staff_list_id, game_id, played_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, row.staff_list_id, row.game_id, row.played_at, row.created_at, row.updated_at]
      );
      logsCount++;
    }
    console.log(`   ✓ Migrated ${logsCount} play logs`);

    // Migrate staff_knowledge
    console.log('\n📚 Step 7: Migrating staff_knowledge...');
    const knowledgeResult = await stagingPool.query('SELECT * FROM staff_knowledge');
    let knowledgeCount = 0;
    for (const row of knowledgeResult.rows) {
      await prodClient.query(
        `INSERT INTO staff_knowledge (
          id, staff_list_id, game_id, knows_rules, can_teach, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.id, row.staff_list_id, row.game_id, row.knows_rules,
          row.can_teach, row.notes, row.created_at, row.updated_at
        ]
      );
      knowledgeCount++;
    }
    console.log(`   ✓ Migrated ${knowledgeCount} staff knowledge records`);

    // Commit transaction
    await prodClient.query('COMMIT');
    prodClient.release();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration Summary:');
    console.log(`   • Staff: ${staffCount} records`);
    console.log(`   • Games: ${gamesCount} records`);
    console.log(`   • Images: ${imagesCount} records`);
    console.log(`   • Content Checks: ${checksCount} records`);
    console.log(`   • Play Logs: ${logsCount} records`);
    console.log(`   • Staff Knowledge: ${knowledgeCount} records`);
    console.log('\n🎉 Database migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
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

// Run migration
migrateData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
