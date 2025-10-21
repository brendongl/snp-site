const { Pool } = require('pg');
const Airtable = require('airtable');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu');
const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';

/**
 * Generate MD5 hash for image URL
 */
function generateImageHash(imageUrl) {
  return crypto.createHash('md5').update(imageUrl).digest('hex');
}

async function migrateImages() {
  const client = await pool.connect();

  try {
    console.log('🔍 Fetching games from Airtable...\n');

    const gamesWithImages = [];

    // Fetch all games from Airtable with their images
    await base(tableId).select({
      fields: ['Game Name', 'Images'],
      view: 'viwRxfowOlqk8LkAd',
    }).eachPage((records, fetchNextPage) => {
      records.forEach((record) => {
        const gameName = record.get('Game Name');
        const images = record.get('Images'); // Array of image attachments

        if (images && images.length > 0) {
          gamesWithImages.push({
            airtableId: record.id,
            name: gameName,
            images: images,
          });
        }
      });

      fetchNextPage();
    });

    console.log(`✅ Found ${gamesWithImages.length} games with images in Airtable\n`);

    if (gamesWithImages.length === 0) {
      console.log('⚠️  No games with images found. Nothing to migrate.');
      return;
    }

    console.log('📝 Migrating images to PostgreSQL game_images table...\n');

    let totalImagesAdded = 0;
    let gamesUpdated = 0;
    let gamesSkipped = 0;
    let errorCount = 0;

    for (const gameData of gamesWithImages) {
      try {
        // Find the game in PostgreSQL by matching name
        const gameResult = await client.query(
          'SELECT id FROM games WHERE name = $1 LIMIT 1',
          [gameData.name]
        );

        if (gameResult.rows.length === 0) {
          console.log(`⚠️  Skipping: "${gameData.name}" not found in PostgreSQL`);
          gamesSkipped++;
          continue;
        }

        const gameId = gameResult.rows[0].id;

        // Check if images already exist for this game
        const existingImagesResult = await client.query(
          'SELECT COUNT(*) as count FROM game_images WHERE game_id = $1',
          [gameId]
        );

        const existingImageCount = parseInt(existingImagesResult.rows[0].count);

        if (existingImageCount > 0) {
          console.log(`ℹ️  Skipping: "${gameData.name}" already has ${existingImageCount} image(s)`);
          gamesSkipped++;
          continue;
        }

        // Add images for this game
        let imagesAdded = 0;
        for (const image of gameData.images) {
          const imageUrl = image.thumbnails?.large?.url || image.url;
          const fileName = image.filename || 'image.jpg';
          const hash = generateImageHash(imageUrl);

          try {
            await client.query(
              `INSERT INTO game_images (game_id, url, file_name, hash, created_at)
               VALUES ($1, $2, $3, $4, NOW())
               ON CONFLICT (game_id, hash) DO NOTHING`,
              [gameId, imageUrl, fileName, hash]
            );
            imagesAdded++;
          } catch (imageError) {
            console.error(`   ❌ Failed to add image for "${gameData.name}":`, imageError.message);
          }
        }

        if (imagesAdded > 0) {
          console.log(`✅ Added ${imagesAdded} image(s) for "${gameData.name}"`);
          gamesUpdated++;
          totalImagesAdded += imagesAdded;
        }

      } catch (error) {
        console.error(`❌ Error processing "${gameData.name}":`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Games updated: ${gamesUpdated}`);
    console.log(`📸 Total images added: ${totalImagesAdded}`);
    console.log(`⚠️  Games skipped: ${gamesSkipped}`);
    console.log(`❌ Errors: ${errorCount}`);

    // Verify the results
    const verifyResult = await client.query(`
      SELECT COUNT(DISTINCT game_id) as games_with_images, COUNT(*) as total_images
      FROM game_images
    `);

    console.log(`\n🔍 Verification:`);
    console.log(`   Games with images: ${verifyResult.rows[0].games_with_images}`);
    console.log(`   Total images in database: ${verifyResult.rows[0].total_images}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('🚀 Starting image migration from Airtable to PostgreSQL...\\n');
migrateImages();
