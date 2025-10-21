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
const STAFF_KNOWLEDGE_TABLE_ID = 'tblEsKvKBFfmN8GJe';

interface StaffKnowledgeRecord {
  id: string;
  fields: {
    'Staff'?: string[];
    'Game'?: string[];
    'Knowledge Level'?: string;
    'Can Teach'?: boolean;
    'Notes'?: string;
  };
}

async function migrateStaffKnowledge() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('👨‍🎓 Starting Staff Knowledge migration...');

    // Initialize Airtable
    const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
    const base = airtable.base(SNP_GAMES_LIST_BASE_ID);
    const knowledgeTable = base(STAFF_KNOWLEDGE_TABLE_ID);

    // Fetch all staff knowledge records from Airtable
    console.log('\n📥 Fetching Staff Knowledge from Airtable...');
    const records: StaffKnowledgeRecord[] = [];

    await knowledgeTable
      .select()
      .eachPage((recordBatch: any[], fetchNextPage) => {
        recordBatch.forEach((record: any) => {
          records.push({
            id: record.id,
            fields: {
              'Staff': record.get('Staff'),
              'Game': record.get('Game'),
              'Knowledge Level': record.get('Knowledge Level'),
              'Can Teach': record.get('Can Teach'),
              'Notes': record.get('Notes'),
            },
          });
        });
        fetchNextPage();
      });

    console.log(`✅ Fetched ${records.length} staff knowledge records from Airtable`);

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let knowledgeInserted = 0;
      let recordsMissing = 0;
      let errors = 0;

      // Insert each staff knowledge record
      for (const record of records) {
        try {
          // Get staff ID (first linked record)
          const staffId = record.fields['Staff']?.[0];
          // Get game ID (first linked record)
          const gameId = record.fields['Game']?.[0];

          if (!staffId) {
            console.warn(`⚠️  Knowledge record ${record.id} has no linked staff, skipping...`);
            recordsMissing++;
            continue;
          }

          if (!gameId) {
            console.warn(`⚠️  Knowledge record ${record.id} has no linked game, skipping...`);
            recordsMissing++;
            continue;
          }

          // Map knowledge level to confidence level (0-100)
          let confidenceLevel = 50; // Default
          const knowledgeLevel = record.fields['Knowledge Level'];
          if (knowledgeLevel) {
            const levelMap: { [key: string]: number } = {
              'Beginner': 25,
              'Intermediate': 50,
              'Advanced': 75,
              'Expert': 100,
              'Master': 100,
            };
            confidenceLevel = levelMap[knowledgeLevel] || 50;
          }

          // Insert staff knowledge record
          await client.query(
            `INSERT INTO staff_knowledge (
              id, staff_member_id, game_id, confidence_level, can_teach, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              staff_member_id = $2,
              game_id = $3,
              confidence_level = $4,
              can_teach = $5,
              notes = $6,
              updated_at = NOW()`,
            [
              record.id,
              staffId,
              gameId,
              confidenceLevel,
              record.fields['Can Teach'] || false,
              record.fields['Notes'] || null,
            ]
          );

          knowledgeInserted++;

          // Progress indicator
          if (knowledgeInserted % 50 === 0) {
            console.log(`  📊 Progress: ${knowledgeInserted}/${records.length} records inserted...`);
          }
        } catch (error) {
          console.error(`⚠️  Error inserting staff knowledge ${record.id}:`, error);
          errors++;
        }
      }

      // Commit transaction
      await client.query('COMMIT');

      console.log(`\n✅ Staff Knowledge migration completed!`);
      console.log(`   - Records inserted: ${knowledgeInserted}/${records.length}`);
      if (recordsMissing > 0) {
        console.log(`   - Records skipped (missing data): ${recordsMissing}`);
      }
      if (errors > 0) {
        console.log(`   - Errors: ${errors}`);
      }

      // Log summary statistics
      const knowledgeCount = await client.query('SELECT COUNT(*) FROM staff_knowledge');
      console.log(`\n📈 Database summary:`);
      console.log(`   - Total staff knowledge records in database: ${knowledgeCount.rows[0].count}`);

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
migrateStaffKnowledge().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
