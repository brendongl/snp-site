/**
 * Migration Script: Old ContentsChecker → Content Check Log
 *
 * This script:
 * 1. Fetches all records from the old ContentsChecker table
 * 2. Analyzes notes to determine status
 * 3. Creates new records in Content Check Log table
 * 4. Only migrates the most recent "OK" report per game
 * 5. Migrates ALL records with issues
 */

import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'apppFvSDh2JBc0qAu';
const OLD_TABLE_ID = 'tblktKhEnX7PMls42'; // ContentsChecker
const NEW_TABLE_ID = 'tblHWhNrHc9r3u42Q'; // Content Check Log

interface OldCheckRecord {
  id: string;
  fields: {
    Record?: number;
    'Staff Name'?: string[];
    'Board Game Checked'?: string[];
    Notes?: string;
    Photos?: any[];
    Created?: string;
  };
}

interface NewCheckRecord {
  'Record ID': string;
  'Board Game'?: string[];
  'Check Date'?: string;
  'Inspector'?: string[];
  Status: 'Perfect Condition' | 'Minor Issues' | 'Major Issues' | 'Unplayable';
  'Missing Pieces'?: string;
  Notes?: string;
  Photos?: any[];
  'Box Condition'?: string;
}

// Keywords that indicate issues
const ISSUE_KEYWORDS = [
  'missing',
  'damaged',
  'torn',
  'worn',
  'broken',
  'counterfeit',
  'fake',
  'duplicate',
  'ripped',
  'bent',
  'stained',
  'incomplete',
];

const MAJOR_ISSUE_KEYWORDS = [
  'unplayable',
  'destroyed',
  'many missing',
  'multiple missing',
  'severely damaged',
  'fake',
  'counterfeit',
];

const OK_PATTERNS = [
  /^ok$/i,
  /^all good$/i,
  /^content ok$/i,
  /^good$/i,
  /^fine$/i,
  /^👍+$/,
  /^🆗+$/,
  /^✓+$/,
  /^okay$/i,
  /^alright$/i,
];

/**
 * Determine if notes indicate an OK report
 */
function isOkReport(notes: string | undefined): boolean {
  if (!notes || notes.trim() === '') return true;

  const trimmed = notes.trim();

  // Check against OK patterns
  for (const pattern of OK_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // If it's very short and only contains emojis/symbols, consider it OK
  if (trimmed.length < 20 && !/[a-zA-Z]/.test(trimmed)) return true;

  return false;
}

/**
 * Analyze notes and determine status
 */
function analyzeNotes(notes: string | undefined): {
  status: NewCheckRecord['Status'];
  missingPieces: string | undefined;
} {
  if (!notes || isOkReport(notes)) {
    return {
      status: 'Perfect Condition',
      missingPieces: undefined,
    };
  }

  const notesLower = notes.toLowerCase();

  // Check for major issues
  for (const keyword of MAJOR_ISSUE_KEYWORDS) {
    if (notesLower.includes(keyword)) {
      return {
        status: 'Major Issues',
        missingPieces: extractMissingPieces(notes),
      };
    }
  }

  // Check for any issues
  for (const keyword of ISSUE_KEYWORDS) {
    if (notesLower.includes(keyword)) {
      return {
        status: 'Minor Issues',
        missingPieces: extractMissingPieces(notes),
      };
    }
  }

  // No issues found
  return {
    status: 'Perfect Condition',
    missingPieces: undefined,
  };
}

/**
 * Extract missing pieces information from notes
 */
function extractMissingPieces(notes: string): string | undefined {
  const sentences = notes.split(/[.!?\n]/);
  const missingPieces: string[] = [];

  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes('missing')) {
      missingPieces.push(sentence.trim());
    }
  }

  return missingPieces.length > 0 ? missingPieces.join('. ') : undefined;
}

/**
 * Group records by board game
 */
function groupByGame(records: OldCheckRecord[]): Map<string, OldCheckRecord[]> {
  const grouped = new Map<string, OldCheckRecord[]>();

  for (const record of records) {
    const gameId = record.fields['Board Game Checked']?.[0];
    if (!gameId) continue;

    if (!grouped.has(gameId)) {
      grouped.set(gameId, []);
    }
    grouped.get(gameId)!.push(record);
  }

  return grouped;
}

/**
 * Main migration function
 */
async function migrate() {
  if (!AIRTABLE_API_KEY) {
    console.error('❌ AIRTABLE_API_KEY is not set');
    process.exit(1);
  }

  const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
  const base = airtable.base(BASE_ID);

  console.log('🔄 Fetching records from old ContentsChecker table...');

  // Fetch all old records
  const oldRecords: OldCheckRecord[] = [];
  await base(OLD_TABLE_ID)
    .select()
    .eachPage((records, fetchNextPage) => {
      oldRecords.push(...(records as any));
      fetchNextPage();
    });

  console.log(`📊 Found ${oldRecords.length} records in old table`);

  // Group by game
  const gameGroups = groupByGame(oldRecords);
  console.log(`🎮 Found ${gameGroups.size} unique board games`);

  // Process records
  const recordsToMigrate: OldCheckRecord[] = [];
  let okReportsKept = 0;
  let issueReportsKept = 0;
  let okReportsSkipped = 0;

  for (const [gameId, records] of gameGroups.entries()) {
    // Separate OK reports from issue reports
    const okReports: OldCheckRecord[] = [];
    const issueReports: OldCheckRecord[] = [];

    for (const record of records) {
      if (isOkReport(record.fields.Notes)) {
        okReports.push(record);
      } else {
        issueReports.push(record);
      }
    }

    // Add all issue reports
    recordsToMigrate.push(...issueReports);
    issueReportsKept += issueReports.length;

    // Add only the most recent OK report
    if (okReports.length > 0) {
      // Sort by date (most recent first)
      okReports.sort((a, b) => {
        const dateA = new Date(a.fields.Created || 0).getTime();
        const dateB = new Date(b.fields.Created || 0).getTime();
        return dateB - dateA;
      });

      recordsToMigrate.push(okReports[0]);
      okReportsKept++;
      okReportsSkipped += okReports.length - 1;
    }
  }

  console.log(`\n📋 Migration Summary:`);
  console.log(`  ✅ Issue reports to migrate: ${issueReportsKept}`);
  console.log(`  ✅ OK reports to migrate (latest per game): ${okReportsKept}`);
  console.log(`  ⏭️  OK reports to skip (older duplicates): ${okReportsSkipped}`);
  console.log(`  📦 Total records to migrate: ${recordsToMigrate.length}`);

  // Create new records
  console.log(`\n🚀 Starting migration...`);

  let successCount = 0;
  let errorCount = 0;
  const errors: { record: OldCheckRecord; error: string }[] = [];

  // Batch create records (max 10 per batch)
  const batchSize = 10;
  for (let i = 0; i < recordsToMigrate.length; i += batchSize) {
    const batch = recordsToMigrate.slice(i, i + batchSize);
    const newRecords: any[] = [];

    for (const oldRecord of batch) {
      const analysis = analyzeNotes(oldRecord.fields.Notes);

      const newRecord: any = {
        fields: {
          'Record ID': `MIGRATED-${oldRecord.fields.Record || oldRecord.id}`,
          'Board Game': oldRecord.fields['Board Game Checked'],
          'Check Date': oldRecord.fields.Created?.split('T')[0],
          'Inspector': oldRecord.fields['Staff Name'],
          Status: analysis.status,
          'Missing Pieces': analysis.missingPieces,
          Notes: oldRecord.fields.Notes,
          // Photos: oldRecord.fields.Photos, // Skipped - Airtable API doesn't support copying attachments in this format
        },
      };

      newRecords.push(newRecord);
    }

    try {
      await base(NEW_TABLE_ID).create(newRecords);
      successCount += newRecords.length;
      console.log(`✓ Migrated batch ${Math.floor(i / batchSize) + 1} (${newRecords.length} records)`);
    } catch (error: any) {
      errorCount += newRecords.length;
      console.error(`✗ Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      batch.forEach((record) => {
        errors.push({ record, error: error.message });
      });
    }
  }

  console.log(`\n✅ Migration Complete!`);
  console.log(`  ✓ Successfully migrated: ${successCount} records`);
  console.log(`  ✗ Failed: ${errorCount} records`);

  if (errors.length > 0) {
    console.log(`\n❌ Errors encountered:`);
    errors.forEach(({ record, error }) => {
      console.log(`  Record ${record.fields.Record}: ${error}`);
    });
  }

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    oldTableRecords: oldRecords.length,
    uniqueGames: gameGroups.size,
    issueReportsMigrated: issueReportsKept,
    okReportsMigrated: okReportsKept,
    okReportsSkipped: okReportsSkipped,
    totalMigrated: successCount,
    errors: errorCount,
  };

  console.log(`\n📄 Migration Report:`);
  console.log(JSON.stringify(report, null, 2));
}

// Run migration
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
