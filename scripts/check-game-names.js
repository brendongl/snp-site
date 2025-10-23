const { Pool } = require('pg');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('🔍 Checking if Airtable games exist in PostgreSQL');
console.log('================================================\n');

const pool = new Pool({ connectionString: connectionUrl });

// Games from Airtable that have Cost Price
const testGames = [
  '7 Wonders',
  'Not Alone',
  'Fire Tower',
  'Infinity Gauntlet: A Love Letter Game',
  'Love Letter',
  'Battleships',
  'Space Invader',
  'Clank! A Deck-Building Adventure',
  'POOP: The Game',
  'That Time You Killed Me'
];

async function checkGames() {
  const client = await pool.connect();
  try {
    console.log('Checking if these games exist in PostgreSQL:\n');

    for (const gameName of testGames) {
      const result = await client.query(
        'SELECT id, name, cost_price FROM games WHERE name = $1',
        [gameName]
      );

      if (result.rows.length > 0) {
        const game = result.rows[0];
        console.log(`✓ FOUND: "${gameName}"`);
        console.log(`  - ID: ${game.id}`);
        console.log(`  - cost_price: ${game.cost_price || 'NULL'}`);
      } else {
        console.log(`✗ NOT FOUND: "${gameName}"`);
        // Try partial match
        const partialResult = await client.query(
          `SELECT id, name, cost_price FROM games WHERE name ILIKE $1 LIMIT 3`,
          [`%${gameName.split(' ')[0]}%`]
        );
        if (partialResult.rows.length > 0) {
          console.log(`  Similar games found:`);
          partialResult.rows.forEach(g => {
            console.log(`    - "${g.name}" (ID: ${g.id})`);
          });
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.release();
    await pool.end();
  }
}

checkGames();
