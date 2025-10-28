/**
 * API Endpoint: Update Video Game Image URLs to Use Cached Images
 *
 * Converts Nintendo CDN URLs to cached image paths using MD5 hashing.
 * Run this after uploading images to the persistent volume.
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper: Generate MD5 hash of a string
function md5Hash(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

export async function POST() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Update Video Game Image URLs to Cached Paths');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get all video games with their current image URLs
    const result = await pool.query(`
      SELECT id, name, image_url, image_landscape_url, image_portrait_url
      FROM video_games
      WHERE image_landscape_url IS NOT NULL
         OR image_portrait_url IS NOT NULL
         OR image_url IS NOT NULL
      ORDER BY name
    `);

    console.log(`📊 Found ${result.rows.length} video games with image URLs\n`);

    let updated = 0;
    let failed = 0;
    const updates: any[] = [];

    for (const game of result.rows) {
      try {
        const gameUpdates: any = {};

        // Update main image URL
        if (game.image_url && game.image_url.includes('nintendo.com')) {
          const hash = md5Hash(game.image_url);
          gameUpdates.image_url = `/api/video-games/cached-images/${hash}.jpg`;
        }

        // Update landscape URL
        if (game.image_landscape_url && game.image_landscape_url.includes('nintendo.com')) {
          const hash = md5Hash(game.image_landscape_url);
          gameUpdates.image_landscape_url = `/api/video-games/cached-images/${hash}.jpg`;
        }

        // Update portrait URL
        if (game.image_portrait_url && game.image_portrait_url.includes('nintendo.com')) {
          const hash = md5Hash(game.image_portrait_url);
          gameUpdates.image_portrait_url = `/api/video-games/cached-images/${hash}.jpg`;
        }

        if (Object.keys(gameUpdates).length > 0) {
          // Build UPDATE query dynamically
          const setClause = Object.keys(gameUpdates)
            .map((key, i) => `${key} = $${i + 1}`)
            .join(', ');

          const values = Object.values(gameUpdates);
          values.push(game.id);

          await pool.query(
            `UPDATE video_games SET ${setClause} WHERE id = $${values.length}`,
            values
          );

          updated++;
          updates.push({ game: game.name, updates: gameUpdates });
          console.log(`✅ ${game.name} (${game.id})`);
        }

      } catch (error) {
        failed++;
        console.error(`❌ ${game.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Update Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({
      success: true,
      total: result.rows.length,
      updated,
      failed,
      updates: updates.slice(0, 10) // Return first 10 for verification
    });

  } catch (error) {
    console.error('\n❌ Update failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return current status
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN image_landscape_url LIKE '/api/video-games/cached-images/%' THEN 1 END) as cached_landscape,
        COUNT(CASE WHEN image_landscape_url LIKE 'https://assets.nintendo.com/%' THEN 1 END) as external_landscape
      FROM video_games
    `);

    const stats = result.rows[0];

    return NextResponse.json({
      endpoint: '/api/admin/update-video-game-urls',
      usage: 'POST to update all Nintendo CDN URLs to cached paths',
      currentStats: {
        totalGames: parseInt(stats.total),
        cachedUrls: parseInt(stats.cached_landscape),
        externalUrls: parseInt(stats.external_landscape),
        percentCached: Math.round((parseInt(stats.cached_landscape) / parseInt(stats.total)) * 100)
      }
    });
  } catch (error) {
    return NextResponse.json({
      endpoint: '/api/admin/update-video-game-urls',
      usage: 'POST to update all Nintendo CDN URLs to cached paths',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
