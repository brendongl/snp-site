/**
 * Analyze Airtable Content Check Log table
 * Check what inspector data exists in Airtable vs PostgreSQL
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
if (!AIRTABLE_API_KEY) {
  throw new Error('AIRTABLE_API_KEY environment variable is required');
}

const SNP_GAMES_LIST_BASE_ID = 'apppFvSDh2JBc0qAu';
const CONTENT_CHECK_LOG_TABLE_ID = 'tblHWhNrHc9r3u42Q'; // From AIRTABLE_SCHEMA.md line 341

async function analyzeAirtableContentChecks() {
  try {
    console.log('\n🔍 Analyzing Airtable Content Check Log table...\n');

    const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
    const base = airtable.base(SNP_GAMES_LIST_BASE_ID);
    const contentCheckTable = base(CONTENT_CHECK_LOG_TABLE_ID);

    const checks = [];

    console.log('📥 Fetching content checks from Airtable...\n');

    await contentCheckTable
      .select({
        maxRecords: 20, // Sample only
      })
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          checks.push({
            id: record.id,
            fields: record.fields,
          });
        });
        fetchNextPage();
      });

    console.log(`✅ Fetched ${checks.length} sample content checks\n`);
    console.log('=' .repeat(60));
    console.log('AIRTABLE CONTENT CHECK LOG SCHEMA');
    console.log('='.repeat(60));

    // Get all unique field names
    const allFields = new Set();
    checks.forEach(check => {
      Object.keys(check.fields).forEach(field => allFields.add(field));
    });

    console.log('\n📋 Available fields:');
    Array.from(allFields).sort().forEach(field => {
      console.log(`  - ${field}`);
    });

    // Analyze sample records
    console.log('\n' + '='.repeat(60));
    console.log('SAMPLE RECORDS (First 5)');
    console.log('='.repeat(60));

    checks.slice(0, 5).forEach((check, index) => {
      console.log(`\n${index + 1}. Record ID: ${check.id}`);
      console.log(`   Fields:`);

      // Show key fields
      const keyFields = ['Board Game', 'Inspector', 'Latest Check', 'Content Check Status', 'Notes'];
      keyFields.forEach(fieldName => {
        if (check.fields[fieldName] !== undefined) {
          let value = check.fields[fieldName];

          // Format array values
          if (Array.isArray(value)) {
            value = `[${value.join(', ')}]`;
          }

          console.log(`   - ${fieldName}: ${value}`);
        } else {
          console.log(`   - ${fieldName}: <not set>`);
        }
      });
    });

    // Count inspector data availability
    console.log('\n' + '='.repeat(60));
    console.log('INSPECTOR DATA AVAILABILITY');
    console.log('='.repeat(60));

    let withInspector = 0;
    let withoutInspector = 0;

    // Fetch all records for counting
    const allChecks = [];
    await contentCheckTable
      .select()
      .eachPage((records, fetchNextPage) => {
        records.forEach((record) => {
          const inspector = record.get('Inspector');
          if (inspector && (Array.isArray(inspector) ? inspector.length > 0 : true)) {
            withInspector++;
          } else {
            withoutInspector++;
          }

          if (allChecks.length < 10) {
            allChecks.push({
              id: record.id,
              inspector: inspector,
              boardGame: record.get('Board Game'),
              checkDate: record.get('Latest Check'),
            });
          }
        });
        fetchNextPage();
      });

    const total = withInspector + withoutInspector;
    console.log(`\n📊 Statistics:`);
    console.log(`   Total records: ${total}`);
    console.log(`   With Inspector: ${withInspector} (${((withInspector/total)*100).toFixed(1)}%)`);
    console.log(`   Without Inspector: ${withoutInspector} (${((withoutInspector/total)*100).toFixed(1)}%)`);

    if (allChecks.length > 0) {
      console.log('\n📋 Sample Inspector values:');
      allChecks.forEach(check => {
        const inspectorStr = Array.isArray(check.inspector)
          ? check.inspector.join(', ')
          : check.inspector || 'NULL';
        console.log(`  - ${check.id}: ${inspectorStr}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

analyzeAirtableContentChecks().catch(console.error);
