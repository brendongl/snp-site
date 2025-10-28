/**
 * Update Image URLs to Use Cached Images Path
 *
 * Updates all video game image URLs from /api/video-games/images/[hash].jpg
 * to /api/video-games/cached-images/[hash].jpg
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function updateImageUrls() {
  console.log('🔄 Updating Image URLs to Cached Images Path\n');
  console.log(`Database: ${DATABASE_URL.split('@')[1] || 'local'}\n`);

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // Update all image URLs that point to /api/video-games/images/ to /api/video-games/cached-images/
    const result = await client.query(`
      UPDATE video_games
      SET
        image_landscape_url = REPLACE(image_landscape_url, '/api/video-games/images/', '/api/video-games/cached-images/'),
        image_portrait_url = REPLACE(image_portrait_url, '/api/video-games/images/', '/api/video-games/cached-images/'),
        image_screenshot_url = REPLACE(image_screenshot_url, '/api/video-games/images/', '/api/video-games/cached-images/'),
        updated_at = NOW()
      WHERE platform = 'switch'
        AND (image_landscape_url LIKE '/api/video-games/images/%'
          OR image_portrait_url LIKE '/api/video-games/images/%'
          OR image_screenshot_url LIKE '/api/video-games/images/%')
      RETURNING id, name
    `);

    console.log(`✅ Updated ${result.rowCount} games\n`);

    // Verify the update
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_landscape_url LIKE '/api/video-games/cached-images/%' THEN 1 END) as cached_landscape,
        COUNT(CASE WHEN image_portrait_url LIKE '/api/video-games/cached-images/%' THEN 1 END) as cached_portrait,
        COUNT(CASE WHEN image_screenshot_url LIKE '/api/video-games/cached-images/%' THEN 1 END) as cached_screenshot
      FROM video_games
      WHERE platform = 'switch'
    `);

    const row = stats.rows[0];
    console.log('Database Status:');
    console.log(`  Total games: ${row.total}`);
    console.log(`  Cached landscape: ${row.cached_landscape}/${row.total} (${Math.round(row.cached_landscape / row.total * 100)}%)`);
    console.log(`  Cached portrait: ${row.cached_portrait}/${row.total} (${Math.round(row.cached_portrait / row.total * 100)}%)`);
    console.log(`  Cached screenshot: ${row.cached_screenshot}/${row.total} (${Math.round(row.cached_screenshot / row.total * 100)}%)`);

    console.log('\n✅ All image URLs updated successfully!');

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateImageUrls().catch(console.error);
