const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
  ssl: false
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function loadCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header
  const dataLines = lines.slice(1);

  const updates = {
    description: [],
    categories: [],
    deposit: [],
    gameSize: []
  };

  for (const line of dataLines) {
    const values = parseCSVLine(line);
    const [type, gameId, gameName, bggId, description, categories, deposit, gameSize] = values;

    // Parse description (row 2)
    if (type === 'missing Description' && description && description.trim()) {
      updates.description.push({
        id: gameId,
        name: gameName,
        bgg_id: bggId,
        description: description.trim()
      });
    }

    // Parse categories (row 10)
    if (type === 'missing Categories' && categories && categories.trim()) {
      const categoryArray = categories.split(',').map(c => c.trim());
      updates.categories.push({
        id: gameId,
        name: gameName,
        bgg_id: bggId,
        categories: categoryArray
      });
    }

    // Parse deposit
    if (type === 'missing Deposit' && deposit && deposit.trim()) {
      updates.deposit.push({
        id: gameId,
        name: gameName,
        bgg_id: bggId,
        deposit: parseFloat(deposit.trim())
      });
    }

    // Parse game size
    if (type === 'missing Game Size' && gameSize && gameSize.trim()) {
      updates.gameSize.push({
        id: gameId,
        name: gameName,
        bgg_id: bggId,
        game_size: parseInt(gameSize.trim())
      });
    }
  }

  return updates;
}

async function updateDatabase() {
  console.log('='.repeat(80));
  console.log('UPDATING MISSING RENTAL DATA IN POSTGRES');
  console.log('='.repeat(80));

  try {
    const csvPath = path.join(__dirname, '..', 'GAMES_MISSING_DATA_REPORT.csv');
    console.log(`\n📋 Loading CSV from: ${csvPath}`);

    const updates = loadCSV(csvPath);

    console.log('\n📊 Data to update:');
    console.log(`  - Descriptions: ${updates.description.length}`);
    console.log(`  - Categories: ${updates.categories.length}`);
    console.log(`  - Deposits: ${updates.deposit.length}`);
    console.log(`  - Game Sizes: ${updates.gameSize.length}`);

    let stats = {
      descriptionsUpdated: 0,
      categoriesUpdated: 0,
      depositsUpdated: 0,
      gameSizesUpdated: 0,
      errors: 0
    };

    // Update descriptions
    console.log('\n\n🔄 Updating descriptions...');
    for (const item of updates.description) {
      try {
        const result = await pool.query(
          'UPDATE games SET description = $1 WHERE id = $2',
          [item.description, item.id]
        );
        if (result.rowCount > 0) {
          console.log(`  ✓ ${item.name}`);
          stats.descriptionsUpdated++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating ${item.name}:`, error.message);
        stats.errors++;
      }
    }

    // Update categories
    console.log('\n🔄 Updating categories...');
    for (const item of updates.categories) {
      try {
        const result = await pool.query(
          'UPDATE games SET categories = $1 WHERE id = $2',
          [item.categories, item.id]
        );
        if (result.rowCount > 0) {
          console.log(`  ✓ ${item.name} → ${item.categories.join(', ')}`);
          stats.categoriesUpdated++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating ${item.name}:`, error.message);
        stats.errors++;
      }
    }

    // Update deposits
    console.log('\n🔄 Updating deposits...');
    for (const item of updates.deposit) {
      try {
        const result = await pool.query(
          'UPDATE games SET deposit = $1 WHERE id = $2',
          [item.deposit, item.id]
        );
        if (result.rowCount > 0) {
          console.log(`  ✓ ${item.name} → ${item.deposit.toLocaleString()} VND`);
          stats.depositsUpdated++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating ${item.name}:`, error.message);
        stats.errors++;
      }
    }

    // Update game sizes
    console.log('\n🔄 Updating game sizes...');
    for (const item of updates.gameSize) {
      try {
        const result = await pool.query(
          'UPDATE games SET game_size = $1 WHERE id = $2',
          [item.game_size, item.id]
        );
        if (result.rowCount > 0) {
          console.log(`  ✓ ${item.name} → Size ${item.game_size}`);
          stats.gameSizesUpdated++;
        }
      } catch (error) {
        console.error(`  ✗ Error updating ${item.name}:`, error.message);
        stats.errors++;
      }
    }

    // Verify no games are missing deposit or game_size
    console.log('\n\n🔍 VERIFICATION - Checking for missing rental data...');

    const missingDepositResult = await pool.query(`
      SELECT COUNT(*) as count,
             ARRAY_AGG(name ORDER BY name) FILTER (WHERE name IS NOT NULL) as game_names
      FROM games
      WHERE deposit IS NULL
    `);

    const missingGameSizeResult = await pool.query(`
      SELECT COUNT(*) as count,
             ARRAY_AGG(name ORDER BY name) FILTER (WHERE name IS NOT NULL) as game_names
      FROM games
      WHERE game_size IS NULL
    `);

    const missingDeposit = parseInt(missingDepositResult.rows[0].count);
    const missingGameSize = parseInt(missingGameSizeResult.rows[0].count);

    console.log('\n📊 FINAL VERIFICATION RESULTS:');
    console.log('='.repeat(80));

    if (missingDeposit === 0 && missingGameSize === 0) {
      console.log('✅ SUCCESS! All games now have deposit and game_size values!');
    } else {
      console.log('⚠️  WARNING: Some games still missing data:');
      if (missingDeposit > 0) {
        console.log(`\n  Missing Deposit: ${missingDeposit} games`);
        console.log('  Games:', missingDepositResult.rows[0].game_names?.slice(0, 10).join(', '));
        if (missingDeposit > 10) {
          console.log(`  ... and ${missingDeposit - 10} more`);
        }
      }
      if (missingGameSize > 0) {
        console.log(`\n  Missing Game Size: ${missingGameSize} games`);
        console.log('  Games:', missingGameSizeResult.rows[0].game_names?.slice(0, 10).join(', '));
        if (missingGameSize > 10) {
          console.log(`  ... and ${missingGameSize - 10} more`);
        }
      }
    }

    console.log('\n\n📊 UPDATE STATISTICS:');
    console.log('='.repeat(80));
    console.table(stats);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

updateDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
