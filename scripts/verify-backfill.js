const { Pool } = require('pg');

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('🔍 Verifying Backfill Data');
console.log('===========================\n');

const pool = new Pool({ connectionString: connectionUrl });

async function verify() {
  const client = await pool.connect();
  try {
    // Check how many games have each field populated
    console.log('1️⃣  Checking field population...\n');

    const checks = [
      { field: 'cost_price', label: 'Cost Price' },
      { field: 'game_size', label: 'Game Size' },
      { field: 'deposit', label: 'Deposit' },
      { field: 'bgg_id', label: 'BGG ID' },
      { field: 'min_playtime', label: 'Min Playtime' },
      { field: 'max_playtime', label: 'Max Playtime' },
    ];

    for (const check of checks) {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM games
        WHERE ${check.field} IS NOT NULL
      `);
      const count = parseInt(result.rows[0].count);
      console.log(`   ${check.label.padEnd(20)}: ${count} games have values`);
    }

    // Show some sample data
    console.log('\n2️⃣  Sample data (first 10 games with any values)...\n');
    const sampleResult = await client.query(`
      SELECT name, cost_price, game_size, deposit, bgg_id, min_playtime, max_playtime
      FROM games
      WHERE cost_price IS NOT NULL
         OR game_size IS NOT NULL
         OR deposit IS NOT NULL
         OR bgg_id IS NOT NULL
         OR min_playtime IS NOT NULL
         OR max_playtime IS NOT NULL
      LIMIT 10
    `);

    if (sampleResult.rows.length === 0) {
      console.log('   ⚠️  NO GAMES have any values in these fields!');
      console.log('   This means Airtable has no data in these columns.');
    } else {
      console.log('   Game Name                    | Cost  | Size | Deposit | BGG ID | Play Time');
      console.log('   --------------------------------------------------------------------------------');
      sampleResult.rows.forEach(row => {
        const name = (row.name || '').substring(0, 28).padEnd(28);
        const cost = row.cost_price ? `$${row.cost_price}` : '-';
        const size = row.game_size || '-';
        const deposit = row.deposit ? `$${row.deposit}` : '-';
        const bgg = row.bgg_id || '-';
        const playtime = row.min_playtime && row.max_playtime
          ? `${row.min_playtime}-${row.max_playtime}m`
          : (row.min_playtime ? `${row.min_playtime}m` : '-');
        console.log(`   ${name} | ${cost.padEnd(5)} | ${size.padEnd(4)} | ${deposit.padEnd(7)} | ${bgg.padEnd(6)} | ${playtime}`);
      });
    }

    // Check total games
    console.log('\n3️⃣  Total games in database...\n');
    const totalResult = await client.query('SELECT COUNT(*) as count FROM games');
    console.log(`   Total games: ${totalResult.rows[0].count}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.release();
    await pool.end();
  }
}

verify();
