import { Pool } from 'pg';
import Airtable from 'airtable';

// Configure connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
if (!AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY environment variable is required');
}

// Airtable config
const GAMES_BASE_ID = 'apppFvSDh2JBc0qAu'; // SNP Games List
const GAMES_TABLE_ID = 'tblIuIJN5q3W6oXNr';

interface GameRecord {
  id: string;
  fields: {
    'Game Name': string;
    'Description'?: string;
    'Categories'?: string[];
    'Year Released'?: number;
    'Complexity'?: number;
    'Min Players'?: string;
    'Max. Players'?: string;
    'Best Player Amount'?: string;
    'Date of Aquisition'?: string;
    'Latest Check Date'?: string;
    'Latest Check Status'?: string[];
    'Latest Check Notes'?: string[];
    'Total Checks'?: number;
    'Sleeved'?: boolean;
    'Box Wrapped'?: boolean;
    'Expansion'?: boolean;
    'Base Game'?: string[];
    'Game Expansions Link'?: string[];
    'Images'?: Array<{ id: string; url: string; filename?: string }>;
  };
}

async function migrateGames() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🎮 Starting games migration...');

    // Initialize Airtable
    const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
    const base = airtable.base(GAMES_BASE_ID);
    const gamesTable = base(GAMES_TABLE_ID);

    // Fetch all games from Airtable
    console.log('\n📥 Fetching games from Airtable...');
    const games: GameRecord[] = [];

    await gamesTable
      .select()
      .eachPage((records: readonly any[], fetchNextPage: () => void) => {
        (records as any[]).forEach((record: any) => {
          games.push({
            id: record.id,
            fields: {
              'Game Name': record.get('Game Name') || 'Unknown',
              'Description': record.get('Description'),
              'Categories': record.get('Categories') || [],
              'Year Released': record.get('Year Released'),
              'Complexity': record.get('Complexity'),
              'Min Players': record.get('Min Players'),
              'Max. Players': record.get('Max. Players'),
              'Best Player Amount': record.get('Best Player Amount'),
              'Date of Aquisition': record.get('Date of Aquisition'),
              'Latest Check Date': record.get('Latest Check Date'),
              'Latest Check Status': record.get('Latest Check Status'),
              'Latest Check Notes': record.get('Latest Check Notes'),
              'Total Checks': record.get('Total Checks'),
              'Sleeved': record.get('Sleeved'),
              'Box Wrapped': record.get('Box Wrapped'),
              'Expansion': record.get('Expansion'),
              'Base Game': record.get('Base Game'),
              'Game Expansions Link': record.get('Game Expansions Link'),
              'Images': record.get('Images'),
            },
          });
        });
        fetchNextPage();
      });

    console.log(`✅ Fetched ${games.length} games from Airtable`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let gamesInserted = 0;
      let imagesInserted = 0;
      let errors = 0;

      // Insert each game
      for (const game of games) {
        try {
          const categoryArray = Array.isArray(game.fields['Categories'])
            ? game.fields['Categories']
            : (game.fields['Categories'] ? [game.fields['Categories']] : []);

          const expansionArray = Array.isArray(game.fields['Game Expansions Link'])
            ? game.fields['Game Expansions Link']
            : (game.fields['Game Expansions Link'] ? [game.fields['Game Expansions Link']] : []);

          // Insert game record
          await client.query(
            `INSERT INTO games (
              id, name, description, categories, year_released, complexity,
              min_players, max_players, best_player_amount, acquisition_date,
              latest_check_date, latest_check_status, latest_check_notes, total_checks,
              sleeved, box_wrapped, is_expansion, game_expansions_link, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              name = $2,
              description = $3,
              categories = $4,
              year_released = $5,
              complexity = $6,
              min_players = $7,
              max_players = $8,
              best_player_amount = $9,
              acquisition_date = $10,
              latest_check_date = $11,
              latest_check_status = $12,
              latest_check_notes = $13,
              total_checks = $14,
              sleeved = $15,
              box_wrapped = $16,
              is_expansion = $17,
              game_expansions_link = $18,
              updated_at = NOW()`,
            [
              game.id,
              game.fields['Game Name'],
              game.fields['Description'] || null,
              JSON.stringify(categoryArray),
              game.fields['Year Released'] || null,
              game.fields['Complexity'] || null,
              game.fields['Min Players'] || null,
              game.fields['Max. Players'] || null,
              game.fields['Best Player Amount'] || null,
              game.fields['Date of Aquisition'] || null,
              game.fields['Latest Check Date'] || null,
              JSON.stringify(game.fields['Latest Check Status'] || []),
              JSON.stringify(game.fields['Latest Check Notes'] || []),
              game.fields['Total Checks'] || 0,
              game.fields['Sleeved'] || false,
              game.fields['Box Wrapped'] || false,
              game.fields['Expansion'] || false,
              JSON.stringify(expansionArray),
            ]
          );

          gamesInserted++;

          // Insert images if they exist
          if (game.fields['Images'] && Array.isArray(game.fields['Images'])) {
            for (const image of game.fields['Images']) {
              try {
                // Generate MD5 hash of URL for deduplication
                const crypto = require('crypto');
                const hash = crypto.createHash('md5').update(image.url).digest('hex');

                await client.query(
                  `INSERT INTO game_images (
                    game_id, file_name, url, hash, created_at
                  ) VALUES ($1, $2, $3, $4, NOW())
                  ON CONFLICT (game_id, hash) DO NOTHING`,
                  [
                    game.id,
                    image.filename || `image-${hash}`,
                    image.url,
                    hash,
                  ]
                );

                imagesInserted++;
              } catch (error) {
                console.error(`⚠️  Error inserting image for game ${game.id}:`, error);
                errors++;
              }
            }
          }

          // Progress indicator
          if (gamesInserted % 50 === 0) {
            console.log(`  📊 Progress: ${gamesInserted}/${games.length} games inserted...`);
          }
        } catch (error) {
          console.error(`⚠️  Error inserting game ${game.id}:`, error);
          errors++;
        }
      }

      // Commit transaction
      await client.query('COMMIT');

      console.log(`\n✅ Migration completed successfully!`);
      console.log(`   - Games inserted: ${gamesInserted}/${games.length}`);
      console.log(`   - Images inserted: ${imagesInserted}`);
      if (errors > 0) {
        console.log(`   - Errors: ${errors}`);
      }

      // Log summary statistics
      const gameCount = await client.query('SELECT COUNT(*) FROM games');
      const imageCount = await client.query('SELECT COUNT(*) FROM game_images');
      console.log(`\n📈 Database summary:`);
      console.log(`   - Total games in database: ${gameCount.rows[0].count}`);
      console.log(`   - Total images in database: ${imageCount.rows[0].count}`);

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✨ Database connection closed');
  }
}

// Run migration
migrateGames().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
