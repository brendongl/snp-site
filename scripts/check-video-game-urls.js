/**
 * Check current video game image URLs
 * This script checks what URLs are currently in the database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkUrls() {
  try {
    const result = await pool.query(`
      SELECT name, image_url, image_landscape_url, image_portrait_url
      FROM video_games
      WHERE image_landscape_url IS NOT NULL
      LIMIT 10
    `);

    console.log('Sample video game image URLs:');
    console.log('================================');

    result.rows.forEach(game => {
      console.log(`\n${game.name}:`);
      console.log(`  Main: ${game.image_url || 'none'}`);
      console.log(`  Landscape: ${game.image_landscape_url || 'none'}`);
      console.log(`  Portrait: ${game.image_portrait_url || 'none'}`);
    });

    // Check URL patterns
    const patterns = await pool.query(`
      SELECT
        COUNT(CASE WHEN image_landscape_url LIKE '%nintendo.com%' THEN 1 END) as nintendo_urls,
        COUNT(CASE WHEN image_landscape_url LIKE '%/api/video-games/cached-images/%' THEN 1 END) as cached_urls,
        COUNT(CASE WHEN image_landscape_url IS NOT NULL THEN 1 END) as total_with_urls
      FROM video_games
    `);

    const stats = patterns.rows[0];
    console.log('\n\nURL Statistics:');
    console.log('===============');
    console.log(`Total games with images: ${stats.total_with_urls}`);
    console.log(`Nintendo CDN URLs: ${stats.nintendo_urls}`);
    console.log(`Cached API URLs: ${stats.cached_urls}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUrls();