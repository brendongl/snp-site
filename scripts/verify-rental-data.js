const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
  ssl: false
});

async function verifyData() {
  console.log('='.repeat(80));
  console.log('FINAL VERIFICATION OF GAMES DATABASE');
  console.log('='.repeat(80));

  try {
    // Get overall statistics
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_games,
        COUNT(description) as with_description,
        COUNT(categories) FILTER (WHERE array_length(categories, 1) > 0) as with_categories,
        COUNT(mechanisms) FILTER (WHERE array_length(mechanisms, 1) > 0) as with_mechanisms,
        COUNT(complexity) as with_complexity,
        COUNT(deposit) as with_deposit,
        COUNT(game_size) as with_game_size,
        COUNT(cost_price) as with_cost_price
      FROM games
    `);

    const stats = statsResult.rows[0];

    console.log('\n📊 DATABASE STATISTICS:');
    console.log('='.repeat(80));
    console.log(`Total Games:        ${stats.total_games}`);
    console.log(`\nBGG Data:`);
    console.log(`  Descriptions:     ${stats.with_description} / ${stats.total_games} (${(stats.with_description / stats.total_games * 100).toFixed(1)}%)`);
    console.log(`  Categories:       ${stats.with_categories} / ${stats.total_games} (${(stats.with_categories / stats.total_games * 100).toFixed(1)}%)`);
    console.log(`  Mechanisms:       ${stats.with_mechanisms} / ${stats.total_games} (${(stats.with_mechanisms / stats.total_games * 100).toFixed(1)}%)`);
    console.log(`  Complexity:       ${stats.with_complexity} / ${stats.total_games} (${(stats.with_complexity / stats.total_games * 100).toFixed(1)}%)`);
    console.log(`\nRental Data:`);
    console.log(`  Deposits:         ${stats.with_deposit} / ${stats.total_games} (${(stats.with_deposit / stats.total_games * 100).toFixed(1)}%)`);
    console.log(`  Game Sizes:       ${stats.with_game_size} / ${stats.total_games} (${(stats.with_game_size / stats.total_games * 100).toFixed(1)}%)`);
    console.log(`  Cost Prices:      ${stats.with_cost_price} / ${stats.total_games} (${(stats.with_cost_price / stats.total_games * 100).toFixed(1)}%)`);

    // Check for missing deposit
    const missingDepositResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM games
      WHERE deposit IS NULL
    `);

    // Check for missing game_size
    const missingGameSizeResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM games
      WHERE game_size IS NULL
    `);

    const missingDeposit = parseInt(missingDepositResult.rows[0].count);
    const missingGameSize = parseInt(missingGameSizeResult.rows[0].count);

    console.log('\n\n🎯 RENTAL DATA VERIFICATION:');
    console.log('='.repeat(80));

    if (missingDeposit === 0 && missingGameSize === 0) {
      console.log('✅ VERIFIED: All 389 games have BOTH deposit and game_size!');
      console.log('✅ NO GAMES are missing rental data!');
    } else {
      console.log('❌ FAILED VERIFICATION:');
      if (missingDeposit > 0) {
        console.log(`  - ${missingDeposit} games missing deposit`);
      }
      if (missingGameSize > 0) {
        console.log(`  - ${missingGameSize} games missing game_size`);
      }
    }

    // Show a few examples of complete records
    console.log('\n\n📋 SAMPLE COMPLETE RECORDS (First 10 with all rental data):');
    console.log('='.repeat(80));
    const samplesResult = await pool.query(`
      SELECT name, deposit, game_size,
             array_length(categories, 1) as num_categories,
             array_length(mechanisms, 1) as num_mechanisms,
             complexity
      FROM games
      WHERE deposit IS NOT NULL AND game_size IS NOT NULL
      ORDER BY name
      LIMIT 10
    `);

    console.table(samplesResult.rows.map(row => ({
      'Game Name': row.name,
      'Deposit (VND)': row.deposit?.toLocaleString() || 'N/A',
      'Size': row.game_size || 'N/A',
      'Categories': row.num_categories || 0,
      'Mechanisms': row.num_mechanisms || 0,
      'Complexity': row.complexity?.toFixed(2) || 'N/A'
    })));

    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
