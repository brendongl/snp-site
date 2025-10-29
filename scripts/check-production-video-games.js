/**
 * Check Production Video Games
 * This script checks the production database for video game data
 */

require('dotenv').config({ path: '.env.production' });
const { Pool } = require('pg');

// Use production database URL from environment
const productionUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!productionUrl) {
  console.error('❌ No production database URL found');
  console.error('Set PRODUCTION_DATABASE_URL or DATABASE_URL in .env.production');
  process.exit(1);
}

const pool = new Pool({
  connectionString: productionUrl,
  ssl: { rejectUnauthorized: false }
});

async function checkVideoGames() {
  try {
    console.log('🔍 Checking Production Video Games');
    console.log('===================================\n');

    // Check if video_games table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'video_games'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ video_games table does not exist in production');
      return;
    }

    console.log('✅ video_games table exists\n');

    // Get count and sample data
    const countResult = await pool.query('SELECT COUNT(*) FROM video_games');
    console.log(`Total video games: ${countResult.rows[0].count}\n`);

    // Get sample games with URLs
    const sampleGames = await pool.query(`
      SELECT
        id,
        name,
        image_url,
        image_landscape_url,
        image_portrait_url
      FROM video_games
      WHERE image_landscape_url IS NOT NULL
      LIMIT 5
    `);

    console.log('Sample games with images:');
    console.log('-------------------------');
    sampleGames.rows.forEach(game => {
      console.log(`\n${game.name} (${game.id}):`);
      if (game.image_url) console.log(`  Main: ${game.image_url.substring(0, 80)}...`);
      if (game.image_landscape_url) console.log(`  Landscape: ${game.image_landscape_url.substring(0, 80)}...`);
      if (game.image_portrait_url) console.log(`  Portrait: ${game.image_portrait_url.substring(0, 80)}...`);
    });

    // Check URL patterns
    const patterns = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_landscape_url IS NOT NULL THEN 1 END) as with_landscape,
        COUNT(CASE WHEN image_portrait_url IS NOT NULL THEN 1 END) as with_portrait,
        COUNT(CASE WHEN image_landscape_url LIKE '%nintendo.com%' THEN 1 END) as nintendo_urls,
        COUNT(CASE WHEN image_landscape_url LIKE '%/api/video-games/cached-images/%' THEN 1 END) as cached_urls,
        COUNT(CASE WHEN image_landscape_url LIKE '%dekudeals%' THEN 1 END) as dekudeals_urls,
        COUNT(CASE WHEN image_landscape_url LIKE '%titledb%' THEN 1 END) as titledb_urls
      FROM video_games
    `);

    const stats = patterns.rows[0];
    console.log('\n\nURL Statistics:');
    console.log('---------------');
    console.log(`Total games: ${stats.total}`);
    console.log(`Games with landscape images: ${stats.with_landscape}`);
    console.log(`Games with portrait images: ${stats.with_portrait}`);
    console.log(`\nURL Sources:`);
    console.log(`  Nintendo CDN: ${stats.nintendo_urls}`);
    console.log(`  Cached API: ${stats.cached_urls}`);
    console.log(`  DekuDeals: ${stats.dekudeals_urls}`);
    console.log(`  TitleDB: ${stats.titledb_urls}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nConnection refused. Make sure you have the correct production database URL.');
    }
  } finally {
    await pool.end();
  }
}

checkVideoGames();