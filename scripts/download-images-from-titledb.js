const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionUrl = process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');

if (!connectionUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🖼️  Download Images from Titledb');
console.log('='.repeat(60));
console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
console.log('');

const pool = new Pool({ connectionString: connectionUrl });

class ImageDownloader {
  constructor() {
    this.basePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
    this.imagesPath = path.join(this.basePath, 'video-game-images', 'switch');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.imagesPath)) {
      fs.mkdirSync(this.imagesPath, { recursive: true });
    }
  }

  getImagePath(titleId, type) {
    return path.join(this.imagesPath, `${titleId}_${type}.jpg`);
  }

  imageExists(titleId, type) {
    return fs.existsSync(this.getImagePath(titleId, type));
  }

  async downloadImage(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      return null;
    }
  }

  async saveImage(titleId, type, buffer) {
    if (this.imageExists(titleId, type)) {
      return this.getImagePath(titleId, type);
    }

    const imagePath = this.getImagePath(titleId, type);
    fs.writeFileSync(imagePath, buffer);
    return imagePath;
  }
}

async function main() {
  const imageDownloader = new ImageDownloader();
  const client = await pool.connect();

  try {
    // Load titledb
    console.log('📥 Loading titledb from GitHub...');
    const titledbResponse = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/US.en.json');
    const titledb = await titledbResponse.json();
    console.log(`✅ Loaded ${Object.keys(titledb).length} games from titledb\n`);

    // Get all games from database
    console.log('📊 Fetching games from database...');
    const result = await client.query(`
      SELECT id, platform, name, platform_specific_data
      FROM video_games
      WHERE platform = 'switch'
      ORDER BY name
    `);

    console.log(`✅ Found ${result.rows.length} games in database\n`);

    let successCount = 0;
    let noImagesCount = 0;
    let errorCount = 0;

    for (let i = 0; i < result.rows.length; i++) {
      const game = result.rows[i];

      if (i % 50 === 0) {
        console.log(`\n[${i + 1}/${result.rows.length}] Progress: ${Math.round((i / result.rows.length) * 100)}%`);
      }

      // Extract nsuid from platform_specific_data
      let nsuid = null;
      if (game.platform_specific_data) {
        try {
          const data = typeof game.platform_specific_data === 'string'
            ? JSON.parse(game.platform_specific_data)
            : game.platform_specific_data;
          nsuid = data.nsuid;
        } catch (e) {
          // Skip if can't parse
        }
      }

      if (!nsuid) {
        continue;
      }

      // Look up in titledb
      const titledbGame = titledb[nsuid];

      if (!titledbGame) {
        noImagesCount++;
        continue;
      }

      console.log(`${game.name.slice(0, 40)}`);

      let hasImages = false;
      let landscapeUrl = null;
      let portraitUrl = null;
      let screenshotUrl = null;

      if (!dryRun) {
        // Download banner (landscape/hero image)
        if (titledbGame.bannerUrl) {
          const buffer = await imageDownloader.downloadImage(titledbGame.bannerUrl);
          if (buffer) {
            await imageDownloader.saveImage(game.id, 'landscape', buffer);
            landscapeUrl = `/api/video-games/images/${game.id}?type=landscape`;
            console.log(`  📥 Landscape`);
            hasImages = true;
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
        }

        // Download icon (portrait/box art)
        if (titledbGame.iconUrl) {
          const buffer = await imageDownloader.downloadImage(titledbGame.iconUrl);
          if (buffer) {
            await imageDownloader.saveImage(game.id, 'portrait', buffer);
            portraitUrl = `/api/video-games/images/${game.id}?type=portrait`;
            console.log(`  📥 Portrait`);
            hasImages = true;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Download first screenshot
        if (titledbGame.screenshots && titledbGame.screenshots.length > 0) {
          const buffer = await imageDownloader.downloadImage(titledbGame.screenshots[0]);
          if (buffer) {
            await imageDownloader.saveImage(game.id, 'screenshot', buffer);
            screenshotUrl = `/api/video-games/images/${game.id}?type=screenshot`;
            console.log(`  📥 Screenshot`);
            hasImages = true;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update database with image URLs
        if (hasImages) {
          await client.query(`
            UPDATE video_games
            SET
              image_landscape_url = $1,
              image_portrait_url = $2,
              image_screenshot_url = $3,
              updated_at = NOW()
            WHERE id = $4 AND platform = $5
          `, [landscapeUrl, portraitUrl, screenshotUrl, game.id, 'switch']);

          successCount++;
        } else {
          noImagesCount++;
        }
      } else {
        console.log(`  🔍 [DRY RUN] Would download: banner=${!!titledbGame.bannerUrl}, icon=${!!titledbGame.iconUrl}, screenshots=${titledbGame.screenshots?.length || 0}`);
        if (titledbGame.bannerUrl || titledbGame.iconUrl) {
          successCount++;
        } else {
          noImagesCount++;
        }
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Download Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Games with images: ${successCount}`);
    console.log(`⚠️  Games without images: ${noImagesCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('');

  } catch (error) {
    console.error('\n💥 Failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main()
  .then(() => {
    console.log('🎉 Image download completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
