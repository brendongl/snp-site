/**
 * Restore External Image URLs
 *
 * This reverts the database back to external Nintendo CDN URLs
 * so that download-all-video-game-images.js can download them.
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway';

async function restoreExternalUrls() {
  console.log('🔄 Restoring External Image URLs\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    // First, check current state
    const beforeStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_landscape_url LIKE 'https://%' THEN 1 END) as external_landscape,
        COUNT(CASE WHEN image_landscape_url LIKE '/api/%' THEN 1 END) as local_landscape
      FROM video_games
      WHERE platform = 'switch'
    `);

    const before = beforeStats.rows[0];
    console.log('Current State:');
    console.log(`  Total games: ${before.total}`);
    console.log(`  External URLs: ${before.external_landscape}`);
    console.log(`  Local paths: ${before.local_landscape}\n`);

    if (before.external_landscape > 0) {
      console.log('✓ URLs are already external. No changes needed.');
      return;
    }

    // Get games with metadata to restore original URLs
    const games = await client.query(`
      SELECT id, name
      FROM video_games
      WHERE platform = 'switch'
        AND image_landscape_url LIKE '/api/%'
      ORDER BY name
    `);

    console.log(`Restoring URLs for ${games.rows.length} games...\n`);

    let updated = 0;
    for (const game of games.rows) {
      // Reconstruct Nintendo CDN URLs from id (nsuid)
      const nsuid = game.id;

      if (!nsuid) {
        console.log(`  ⚠️  ${game.name}: No id, skipping`);
        continue;
      }

      const landscapeUrl = `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/hero`;
      const portraitUrl = `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/box-emart`;
      const screenshotUrl = `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_1200/ncom/en_US/games/switch/${nsuid}/screenshot-gallery/screenshot01`;

      await client.query(`
        UPDATE video_games
        SET
          image_landscape_url = $1,
          image_portrait_url = $2,
          image_screenshot_url = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [landscapeUrl, portraitUrl, screenshotUrl, game.id]);

      updated++;
      if (updated % 50 === 0) {
        console.log(`  Processed ${updated}/${games.rows.length} games...`);
      }
    }

    console.log(`\n✅ Restored external URLs for ${updated} games\n`);

    // Verify
    const afterStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_landscape_url LIKE 'https://%' THEN 1 END) as external_landscape,
        COUNT(CASE WHEN image_landscape_url LIKE '/api/%' THEN 1 END) as local_landscape
      FROM video_games
      WHERE platform = 'switch'
    `);

    const after = afterStats.rows[0];
    console.log('After Restore:');
    console.log(`  Total games: ${after.total}`);
    console.log(`  External URLs: ${after.external_landscape} (${Math.round(after.external_landscape / after.total * 100)}%)`);
    console.log(`  Local paths: ${after.local_landscape} (${Math.round(after.local_landscape / after.total * 100)}%)`);

  } finally {
    client.release();
    await pool.end();
  }
}

restoreExternalUrls().catch(console.error);
