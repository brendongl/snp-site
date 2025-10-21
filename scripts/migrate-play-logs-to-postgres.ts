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
const PLAY_LOGS_TABLE_ID = 'tblggfqeM2zQaDUEI';

interface PlayLogRecord {
  id: string;
  fields: {
    'Game'?: string[];
    'Logged By'?: string[];
    'Date'?: string;
    'Notes'?: string;
    'Duration (hours)'?: number;
  };
}

async function migratePlayLogs() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('📋 Starting Play Logs migration...');

    // Initialize Airtable
    const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
    const base = airtable.base(SNP_GAMES_LIST_BASE_ID);
    const playLogsTable = base(PLAY_LOGS_TABLE_ID);

    // Fetch all play logs from Airtable
    console.log('\n📥 Fetching Play Logs from Airtable...');
    const playLogs: PlayLogRecord[] = [];

    await playLogsTable
      .select()
      .eachPage((records: readonly any[], fetchNextPage: () => void) => {
        (records as any[]).forEach((record: any) => {
          playLogs.push({
            id: record.id,
            fields: {
              'Game': record.get('Game'),
              'Logged By': record.get('Logged By'),
              'Date': record.get('Date'),
              'Notes': record.get('Notes'),
              'Duration (hours)': record.get('Duration (hours)'),
            },
          });
        });
        fetchNextPage();
      });

    console.log(`✅ Fetched ${playLogs.length} play logs from Airtable`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let logsInserted = 0;
      let logsMissing = 0;
      let errors = 0;

      // Insert each play log
      for (const log of playLogs) {
        try {
          // Get game ID (should be single linked record)
          const gameId = log.fields['Game']?.[0];
          // Get staff list ID (should be single linked record)
          const staffListId = log.fields['Logged By']?.[0];

          if (!gameId) {
            console.warn(`⚠️  Play log ${log.id} has no linked game, skipping...`);
            logsMissing++;
            continue;
          }

          if (!staffListId) {
            console.warn(`⚠️  Play log ${log.id} has no logged by staff member, skipping...`);
            logsMissing++;
            continue;
          }

          // Insert play log record
          await client.query(
            `INSERT INTO play_logs (
              id, game_id, staff_list_id, session_date, notes, duration_hours, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              game_id = $2,
              staff_list_id = $3,
              session_date = $4,
              notes = $5,
              duration_hours = $6,
              updated_at = NOW()`,
            [
              log.id,
              gameId,
              staffListId,
              log.fields['Date'] || null,
              log.fields['Notes'] || null,
              log.fields['Duration (hours)'] || null,
            ]
          );

          logsInserted++;

          // Progress indicator
          if (logsInserted % 50 === 0) {
            console.log(`  📊 Progress: ${logsInserted}/${playLogs.length} logs inserted...`);
          }
        } catch (error) {
          console.error(`⚠️  Error inserting play log ${log.id}:`, error);
          errors++;
        }
      }

      // Commit transaction
      await client.query('COMMIT');

      console.log(`\n✅ Play Logs migration completed!`);
      console.log(`   - Logs inserted: ${logsInserted}/${playLogs.length}`);
      if (logsMissing > 0) {
        console.log(`   - Logs skipped (missing data): ${logsMissing}`);
      }
      if (errors > 0) {
        console.log(`   - Errors: ${errors}`);
      }

      // Log summary statistics
      const logCount = await client.query('SELECT COUNT(*) FROM play_logs');
      console.log(`\n📈 Database summary:`);
      console.log(`   - Total play logs in database: ${logCount.rows[0].count}`);

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
migratePlayLogs().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
