const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get connection URL from environment or command line
const connectionUrl = process.argv.find(arg => arg.startsWith('--db='))?.split('=')[1] || process.env.DATABASE_URL;
const dryRun = process.argv.includes('--dry-run');
const skipImages = process.argv.includes('--skip-images');

if (!connectionUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('🎮 Nintendo Switch Games - FULL Migration Script');
console.log('=================================================\n');
console.log('Mode:', dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE');
console.log('Images:', skipImages ? 'SKIPPED' : 'ENABLED');
console.log('Connection:', connectionUrl.split('@')[1] || 'local');
console.log('');

const pool = new Pool({
  connectionString: connectionUrl,
});

// CSV files directory
const csvDirectory = path.join(process.cwd(), 'switchgamelist');
const switchNames = ['Samus', 'Toad', 'Yoshi', 'Fox', 'LMac', 'Wolf'];

// Image service helper
class ImageDownloader {
  constructor() {
    this.basePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
    this.imagesPath = path.join(this.basePath, 'video-game-images', 'switch');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.imagesPath)) {
      fs.mkdirSync(this.imagesPath, { recursive: true });
      console.log(`✅ Created images directory: ${this.imagesPath}`);
    }
  }

  getImagePath(titleId, type) {
    return path.join(this.imagesPath, `${titleId}_${type}.jpg`);
  }

  imageExists(titleId, type) {
    return fs.existsSync(this.getImagePath(titleId, type));
  }

  async downloadFromNintendoCDN(nsuid, type) {
    const urls = {
      landscape: [
        `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/hero`,
        `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_960/ncom/en_US/games/switch/${nsuid}/hero`,
      ],
      portrait: [
        `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/box-emart`,
        `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_512/ncom/en_US/games/switch/${nsuid}/box-emart`,
      ],
      screenshot: [
        `https://assets.nintendo.com/image/upload/ncom/en_US/games/switch/${nsuid}/screenshot-gallery/screenshot01`,
        `https://assets.nintendo.com/image/upload/f_auto,q_auto,w_960/ncom/en_US/games/switch/${nsuid}/screenshot-gallery/screenshot01`,
      ],
    };

    for (const url of urls[type]) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error) {
        // Silently continue to next URL
      }
    }

    return null; // Return null instead of throwing, so migration can continue
  }

  async downloadAndCache(titleId, nsuid, type) {
    // Check if already cached
    if (this.imageExists(titleId, type)) {
      return this.getImagePath(titleId, type);
    }

    try {
      const imageBuffer = await this.downloadFromNintendoCDN(nsuid, type);
      if (!imageBuffer) {
        return null;
      }

      const imagePath = this.getImagePath(titleId, type);
      fs.writeFileSync(imagePath, imageBuffer);
      return imagePath;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Parse CSV file and extract TitleIDs
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  const titleIds = lines
    .map(line => {
      const match = line.match(/^0x([0-9A-Fa-f]+),/);
      if (!match) return null;
      return match[1].toUpperCase();
    })
    .filter(Boolean);

  return titleIds;
}

/**
 * Filter base games only (ending in 000)
 */
function isBaseGame(titleId) {
  return titleId.endsWith('000');
}

/**
 * Parse all CSV files and find games on any switch
 */
function getAllGamesFromCSVs() {
  const gamesBySwitch = {};
  const allGames = new Map(); // titleId -> array of switch locations

  console.log('📂 Parsing CSV files...');
  for (const switchName of switchNames) {
    const csvFile = `${switchName}_24-10.csv`;
    const csvPath = path.join(csvDirectory, csvFile);

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found: ${csvFile}`);
      process.exit(1);
    }

    const titleIds = parseCSV(csvPath);
    const baseGames = titleIds.filter(isBaseGame);

    gamesBySwitch[switchName] = new Set(baseGames);
    console.log(`   ${switchName}: ${baseGames.length} base games`);

    // Track all games and their locations
    for (const titleId of baseGames) {
      if (!allGames.has(titleId)) {
        allGames.set(titleId, []);
      }
      allGames.get(titleId).push(switchName);
    }
  }

  // Convert to array with location info
  const gamesArray = Array.from(allGames.entries()).map(([titleId, locatedOn]) => ({
    titleId,
    locatedOn,
  }));

  console.log(`\n✅ Found ${gamesArray.length} unique games across all switches`);

  // Sort by number of consoles (descending) for better coverage
  gamesArray.sort((a, b) => b.locatedOn.length - a.locatedOn.length);

  return gamesArray;
}

/**
 * Fetch game metadata from NX-DB
 */
async function fetchGameMetadata(titleId) {
  const url = `https://raw.githubusercontent.com/ghost-land/NX-DB/main/base/${titleId}.json`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Insert game into database
 */
async function insertGame(client, gameData) {
  const query = `
    INSERT INTO video_games (
      id,
      platform,
      name,
      publisher,
      developer,
      release_date,
      description,
      category,
      languages,
      number_of_players,
      rating_content,
      platform_specific_data,
      located_on,
      image_landscape_url,
      image_portrait_url,
      image_screenshot_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id, platform) DO UPDATE SET
      name = EXCLUDED.name,
      publisher = EXCLUDED.publisher,
      developer = EXCLUDED.developer,
      release_date = EXCLUDED.release_date,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      languages = EXCLUDED.languages,
      number_of_players = EXCLUDED.number_of_players,
      rating_content = EXCLUDED.rating_content,
      platform_specific_data = EXCLUDED.platform_specific_data,
      located_on = EXCLUDED.located_on,
      image_landscape_url = EXCLUDED.image_landscape_url,
      image_portrait_url = EXCLUDED.image_portrait_url,
      image_screenshot_url = EXCLUDED.image_screenshot_url,
      updated_at = NOW()
  `;

  const values = [
    gameData.id,
    gameData.platform,
    gameData.name,
    gameData.publisher,
    gameData.developer,
    gameData.release_date,
    gameData.description,
    gameData.category,
    gameData.languages,
    gameData.number_of_players,
    gameData.rating_content,
    gameData.platform_specific_data,
    gameData.located_on,
    gameData.image_landscape_url,
    gameData.image_portrait_url,
    gameData.image_screenshot_url,
  ];

  await client.query(query, values);
}

/**
 * Main migration function
 */
async function migrate() {
  const imageDownloader = new ImageDownloader();
  const client = await pool.connect();

  try {
    // Get all games from CSVs
    const gamesToMigrate = getAllGamesFromCSVs();

    console.log(`\n🎮 Processing ${gamesToMigrate.length} games...\n`);

    let successCount = 0;
    let errorCount = 0;
    let imageSuccessCount = 0;
    let imageMissingCount = 0;
    const errors = [];

    for (let i = 0; i < gamesToMigrate.length; i++) {
      const { titleId, locatedOn } = gamesToMigrate[i];

      if (i % 10 === 0) {
        console.log(`\n[${i + 1}/${gamesToMigrate.length}] Progress: ${Math.round((i / gamesToMigrate.length) * 100)}%`);
      }

      console.log(`\n${titleId} (${locatedOn.length} consoles)`);

      // Fetch metadata from NX-DB
      const metadata = await fetchGameMetadata(titleId);

      if (!metadata) {
        console.log(`   ⚠️  No metadata available, skipping`);
        errorCount++;
        errors.push({ titleId, error: 'No metadata from NX-DB' });
        continue;
      }

      console.log(`   ✅ ${metadata.name}`);

      // Download images (only if not skipped and not dry run)
      let landscapeUrl = null;
      let portraitUrl = null;
      let screenshotUrl = null;
      let hasAllImages = false;

      if (metadata.nsuId && !skipImages && !dryRun) {
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

        const landscape = await imageDownloader.downloadAndCache(titleId, metadata.nsuId, 'landscape');
        const portrait = await imageDownloader.downloadAndCache(titleId, metadata.nsuId, 'portrait');
        const screenshot = await imageDownloader.downloadAndCache(titleId, metadata.nsuId, 'screenshot');

        if (landscape) {
          landscapeUrl = `/api/video-games/images/${titleId}?type=landscape`;
          console.log(`   📥 Landscape ✓`);
        }
        if (portrait) {
          portraitUrl = `/api/video-games/images/${titleId}?type=portrait`;
          console.log(`   📥 Portrait ✓`);
        }
        if (screenshot) {
          screenshotUrl = `/api/video-games/images/${titleId}?type=screenshot`;
          console.log(`   📥 Screenshot ✓`);
        }

        hasAllImages = landscape && portrait;
        if (hasAllImages) {
          imageSuccessCount++;
        } else {
          imageMissingCount++;
          console.log(`   ⚠️  Some images missing`);
        }
      } else if (dryRun) {
        console.log(`   🔍 [DRY RUN] Would download images for nsuid: ${metadata.nsuId}`);
      }

      // Prepare game data
      const gameData = {
        id: titleId,
        platform: 'switch',
        name: metadata.name,
        publisher: metadata.publisher || null,
        developer: metadata.developer || null,
        release_date: metadata.releaseDate || null,
        description: metadata.description || null,
        category: metadata.category || [],
        languages: metadata.languages || [],
        number_of_players: metadata.numberOfPlayers || null,
        rating_content: metadata.ratingContent || [],
        platform_specific_data: JSON.stringify({
          nsuid: metadata.nsuId,
          rights_id: metadata.rightsId,
          latest_update: metadata.latest_update,
          intro: metadata.intro,
          is_demo: metadata.isDemo,
        }),
        located_on: locatedOn,
        image_landscape_url: landscapeUrl,
        image_portrait_url: portraitUrl,
        image_screenshot_url: screenshotUrl,
      };

      // Insert into database
      if (!dryRun) {
        try {
          await insertGame(client, gameData);
          console.log(`   💾 Saved to database`);
          successCount++;
        } catch (error) {
          console.error(`   ❌ Database insertion failed:`, error.message);
          errorCount++;
          errors.push({ titleId, error: error.message });
        }
      } else {
        console.log(`   🔍 [DRY RUN] Would insert into database`);
        successCount++;
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Migration Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successfully migrated: ${successCount} games`);
    console.log(`❌ Errors: ${errorCount} games`);
    if (!skipImages && !dryRun) {
      console.log(`📥 Complete images: ${imageSuccessCount} games`);
      console.log(`⚠️  Missing some images: ${imageMissingCount} games`);
    }

    if (errors.length > 0 && errors.length <= 20) {
      console.log(`\n❌ Errors:`);
      errors.forEach(({ titleId, error }) => {
        console.log(`   - ${titleId}: ${error}`);
      });
    } else if (errors.length > 20) {
      console.log(`\n❌ ${errors.length} errors (showing first 20):`);
      errors.slice(0, 20).forEach(({ titleId, error }) => {
        console.log(`   - ${titleId}: ${error}`);
      });
    }

    console.log('');

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('🎉 Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
