const { Pool } = require('pg');
const { XMLParser } = require('fast-xml-parser');

const connectionUrl = process.argv[2] || process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

console.log('⏱️  Populating Playtime Data from BGG API');
console.log('=========================================\n');
console.log('Connection URL:', connectionUrl.split('@')[1] || 'local');

const pool = new Pool({
  connectionString: connectionUrl,
});

const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';
const RATE_LIMIT_MS = 5000; // 5 seconds between requests as per BGG guidelines
let lastRequestTime = 0;

/**
 * Rate limit BGG API requests
 */
async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`   ⏳ Rate limiting: waiting ${(waitTime / 1000).toFixed(1)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Fetch playtime data from BGG API
 */
async function fetchPlaytimeFromBGG(bggId) {
  await rateLimit();

  const url = `${BGG_API_BASE}/thing?id=${bggId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`BGG API returned status ${response.status}`);
    }

    const xmlText = await response.text();

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const result = parser.parse(xmlText);

    if (!result.items || !result.items.item) {
      throw new Error('Invalid game ID or game not found');
    }

    const item = result.items.item;

    // Extract playtime data
    const minPlaytime = item.minplaytime ? parseInt(item.minplaytime['@_value']) || 0 : 0;
    const maxPlaytime = item.maxplaytime ? parseInt(item.maxplaytime['@_value']) || 0 : 0;

    return { minPlaytime, maxPlaytime };

  } catch (error) {
    console.error(`   ❌ Error fetching BGG data for ID ${bggId}:`, error.message);
    return null;
  }
}

async function populatePlaytime() {
  const client = await pool.connect();
  try {
    console.log('\n1️⃣  Ensuring playtime columns exist...');

    // Ensure columns exist
    await client.query(`
      ALTER TABLE games ADD COLUMN IF NOT EXISTS min_playtime INTEGER
    `);
    await client.query(`
      ALTER TABLE games ADD COLUMN IF NOT EXISTS max_playtime INTEGER
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_games_playtime ON games(min_playtime, max_playtime)
    `);

    console.log('   ✓ Playtime columns verified');

    console.log('\n2️⃣  Fetching games with BGG IDs...');

    // Fetch all games that have a BGG ID but missing playtime data
    const result = await client.query(`
      SELECT id, name, bgg_id, min_playtime, max_playtime
      FROM games
      WHERE bgg_id IS NOT NULL
      ORDER BY name ASC
    `);

    const games = result.rows;
    console.log(`   ✓ Found ${games.length} games with BGG IDs`);

    // Filter games that need playtime data
    const gamesNeedingPlaytime = games.filter(
      g => g.min_playtime === null || g.max_playtime === null
    );

    console.log(`   ℹ️  ${gamesNeedingPlaytime.length} games need playtime data`);
    console.log(`   ℹ️  ${games.length - gamesNeedingPlaytime.length} games already have playtime`);

    if (gamesNeedingPlaytime.length === 0) {
      console.log('\n✅ All games already have playtime data!');
      return;
    }

    console.log('\n3️⃣  Fetching playtime from BGG API...');
    console.log(`   ⏱️  Estimated time: ~${((gamesNeedingPlaytime.length * 5) / 60).toFixed(1)} minutes (5s per game)\n`);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < gamesNeedingPlaytime.length; i++) {
      const game = gamesNeedingPlaytime[i];
      const progress = `[${i + 1}/${gamesNeedingPlaytime.length}]`;

      console.log(`   ${progress} ${game.name} (BGG ID: ${game.bgg_id})`);

      // Fetch playtime data from BGG
      const playtimeData = await fetchPlaytimeFromBGG(game.bgg_id);

      if (!playtimeData) {
        failed++;
        continue;
      }

      // Check if playtime is valid (0 means no data from BGG)
      if (playtimeData.minPlaytime === 0 && playtimeData.maxPlaytime === 0) {
        console.log(`      ⚠️  No playtime data available on BGG`);
        skipped++;
        continue;
      }

      // Update database
      try {
        await client.query(
          `UPDATE games
           SET min_playtime = $1, max_playtime = $2, updated_at = NOW()
           WHERE id = $3`,
          [playtimeData.minPlaytime, playtimeData.maxPlaytime, game.id]
        );

        console.log(`      ✓ Updated: ${playtimeData.minPlaytime}-${playtimeData.maxPlaytime} minutes`);
        updated++;
      } catch (err) {
        console.error(`      ❌ Database error:`, err.message);
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully updated: ${updated} games`);
    console.log(`   ⚠️  Skipped (no BGG data): ${skipped} games`);
    console.log(`   ❌ Failed: ${failed} games`);
    console.log(`\n✅ Playtime population completed!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    await pool.end();
  }
}

populatePlaytime();
