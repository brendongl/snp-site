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
const SNP_GAMES_LIST_BASE_ID = 'apppFvSDh2JBc0qAu';
const CONTENT_CHECKS_TABLE_ID = 'tblN8mYWb0xkJOBcW';

interface ContentCheckRecord {
  id: string;
  fields: {
    'Board Game'?: string[];
    'Inspector'?: string[];
    'Latest Check'?: string;
    'Content Check Status'?: string[];
    'Missing Pieces'?: boolean;
    'Box Condition'?: string;
    'Card Condition'?: string;
    'Is Counterfeit'?: boolean;
    'Notes'?: string;
    'Sleeved'?: boolean;
    'Box Wrapped'?: boolean;
    'Photos'?: Array<{ id: string; url: string; filename?: string; thumbnails?: any }>;
  };
}

async function migrateContentChecks() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔍 Starting Content Checks migration...');

    // Initialize Airtable
    const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
    const base = airtable.base(SNP_GAMES_LIST_BASE_ID);
    const checksTable = base(CONTENT_CHECKS_TABLE_ID);

    // Fetch all content checks from Airtable
    console.log('\n📥 Fetching Content Checks from Airtable...');
    const checks: ContentCheckRecord[] = [];

    await checksTable
      .select()
      .eachPage((records: readonly any[], fetchNextPage: () => void) => {
        (records as any[]).forEach((record: any) => {
          checks.push({
            id: record.id,
            fields: {
              'Board Game': record.get('Board Game'),
              'Inspector': record.get('Inspector'),
              'Latest Check': record.get('Latest Check'),
              'Content Check Status': record.get('Content Check Status'),
              'Missing Pieces': record.get('Missing Pieces'),
              'Box Condition': record.get('Box Condition'),
              'Card Condition': record.get('Card Condition'),
              'Is Counterfeit': record.get('Is Counterfeit'),
              'Notes': record.get('Notes'),
              'Sleeved': record.get('Sleeved'),
              'Box Wrapped': record.get('Box Wrapped'),
              'Photos': record.get('Photos'),
            },
          });
        });
        fetchNextPage();
      });

    console.log(`✅ Fetched ${checks.length} content checks from Airtable`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let checksInserted = 0;
      let checksMissing = 0;
      let errors = 0;

      // Insert each content check
      for (const check of checks) {
        try {
          // Get game ID (first linked record)
          const gameId = check.fields['Board Game']?.[0];
          // Get inspector ID (first linked record)
          const inspectorId = check.fields['Inspector']?.[0];

          if (!gameId) {
            console.warn(`⚠️  Content check ${check.id} has no linked game, skipping...`);
            checksMissing++;
            continue;
          }

          if (!inspectorId) {
            console.warn(`⚠️  Content check ${check.id} has no inspector, skipping...`);
            checksMissing++;
            continue;
          }

          // Process photos if they exist
          let photoUrls: string[] = [];
          if (check.fields['Photos'] && Array.isArray(check.fields['Photos'])) {
            photoUrls = check.fields['Photos'].map((photo) => photo.url);
          }

          // Insert content check record
          await client.query(
            `INSERT INTO content_checks (
              id, game_id, inspector_id, check_date, status, missing_pieces,
              box_condition, card_condition, is_fake, notes, sleeved, box_wrapped, photos, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              game_id = $2,
              inspector_id = $3,
              check_date = $4,
              status = $5,
              missing_pieces = $6,
              box_condition = $7,
              card_condition = $8,
              is_fake = $9,
              notes = $10,
              sleeved = $11,
              box_wrapped = $12,
              photos = $13,
              updated_at = NOW()`,
            [
              check.id,
              gameId,
              inspectorId,
              check.fields['Latest Check'] || null,
              JSON.stringify(check.fields['Content Check Status'] || []),
              check.fields['Missing Pieces'] || false,
              check.fields['Box Condition'] || null,
              check.fields['Card Condition'] || null,
              check.fields['Is Counterfeit'] || false,
              check.fields['Notes'] || null,
              check.fields['Sleeved'] || false,
              check.fields['Box Wrapped'] || false,
              JSON.stringify(photoUrls),
            ]
          );

          checksInserted++;

          // Progress indicator
          if (checksInserted % 50 === 0) {
            console.log(`  📊 Progress: ${checksInserted}/${checks.length} checks inserted...`);
          }
        } catch (error) {
          console.error(`⚠️  Error inserting content check ${check.id}:`, error);
          errors++;
        }
      }

      // Commit transaction
      await client.query('COMMIT');

      console.log(`\n✅ Content Checks migration completed!`);
      console.log(`   - Checks inserted: ${checksInserted}/${checks.length}`);
      if (checksMissing > 0) {
        console.log(`   - Checks skipped (missing data): ${checksMissing}`);
      }
      if (errors > 0) {
        console.log(`   - Errors: ${errors}`);
      }

      // Log summary statistics
      const checkCount = await client.query('SELECT COUNT(*) FROM content_checks');
      console.log(`\n📈 Database summary:`);
      console.log(`   - Total content checks in database: ${checkCount.rows[0].count}`);

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
migrateContentChecks().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
