#!/usr/bin/env node
/**
 * Reset Vikunja Database Label Sequence
 *
 * This script directly accesses Vikunja's PostgreSQL database to:
 * 1. Delete all existing labels
 * 2. Reset the auto-increment sequence to 1
 * 3. Recreate labels with IDs starting from 1
 *
 * Required: VIKUNJA_DATABASE_URL environment variable
 * Example: postgresql://vikunja:password@localhost:5432/vikunja
 *
 * Usage:
 *   VIKUNJA_DATABASE_URL=postgresql://... node scripts/reset-vikunja-db-sequence.js
 */

require('dotenv').config();
const { Client } = require('pg');

// Vikunja uses the same database as our application
const DATABASE_URL = process.env.DATABASE_URL;
const VIKUNJA_API_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  console.log('\nMake sure .env file has DATABASE_URL set');
  process.exit(1);
}

if (!VIKUNJA_TOKEN) {
  console.error('❌ VIKUNJA_API_TOKEN not set in environment');
  process.exit(1);
}

// Label configuration with desired IDs
// Comprehensive list covering all possible point values the system awards
const LABELS = [
  // Small values (100-500)
  { id: 1, title: 'points:100', color: '90EE90', desc: 'Play log, knowledge upgrade, simple task' },
  { id: 2, title: 'points:200', color: '98FB98', desc: 'Knowledge add level 1-2' },
  { id: 3, title: 'points:300', color: '00FA9A', desc: 'Knowledge add level 1-3' },
  { id: 4, title: 'points:400', color: '3CB371', desc: 'Knowledge add level 1-4' },
  { id: 5, title: 'points:500', color: '2E8B57', desc: 'Knowledge add level 1-5, issue resolution basic' },

  // Mid values (600-900)
  { id: 6, title: 'points:600', color: '20B2AA', desc: 'Knowledge add level 2-3' },
  { id: 7, title: 'points:800', color: '48D1CC', desc: 'Knowledge add level 2-4' },
  { id: 8, title: 'points:900', color: '40E0D0', desc: 'Knowledge add level 3' },

  // 1000s (content checks, teaching base)
  { id: 9, title: 'points:1000', color: '4169E1', desc: 'Content check ×1, teaching ×1×1, photo upload' },
  { id: 10, title: 'points:1200', color: '1E90FF', desc: 'Knowledge add level 3-4' },
  { id: 11, title: 'points:1500', color: '00BFFF', desc: 'Knowledge add level 3-5, level 4-3' },
  { id: 12, title: 'points:2000', color: '87CEEB', desc: 'Content check ×2, teaching ×2×1, knowledge level 4-4' },
  { id: 13, title: 'points:2500', color: '87CEFA', desc: 'Knowledge add level 4-5' },
  { id: 14, title: 'points:3000', color: '6495ED', desc: 'Content check ×3, teaching ×3×1 or ×1×3' },
  { id: 15, title: 'points:4000', color: '4682B4', desc: 'Content check ×4, teaching ×4×1 or ×2×2' },
  { id: 16, title: 'points:5000', color: '5F9EA0', desc: 'Content check ×5, teaching ×5×1' },

  // High values (6000-10000)
  { id: 17, title: 'points:6000', color: '9370DB', desc: 'Teaching ×3×2 or ×2×3' },
  { id: 18, title: 'points:8000', color: '8B008B', desc: 'Teaching ×4×2 or ×2×4' },
  { id: 19, title: 'points:9000', color: '9932CC', desc: 'Teaching ×3×3' },
  { id: 20, title: 'points:10000', color: '8A2BE2', desc: 'Teaching ×5×2 or ×2×5' },

  // Very high values (12000-20000)
  { id: 21, title: 'points:12000', color: 'DA70D6', desc: 'Teaching ×4×3 or ×3×4' },
  { id: 22, title: 'points:15000', color: 'FF00FF', desc: 'Teaching ×5×3 or ×3×5' },
  { id: 23, title: 'points:20000', color: 'FF8C00', desc: 'Major project, teaching ×4×5' },

  // Epic values
  { id: 24, title: 'points:50000', color: 'FF4500', desc: 'Epic achievement (1+ week)' },

  // Issue type labels (IDs 25-26)
  { id: 25, title: 'task', color: 'e74c3c', desc: 'Actionable issue (shows in dashboard, awards points)' },
  { id: 26, title: 'note', color: '95a5a6', desc: 'Non-actionable note (filtered, no points)' },
];

async function main() {
  console.log('🔧 Vikunja Database Label Sequence Reset');
  console.log('=' .repeat(60));
  console.log('');

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    // Connect to Vikunja database
    console.log('📡 Connecting to database (Vikunja labels table)...');
    await client.connect();
    console.log('✅ Connected\n');

    // Step 1: Check current labels
    console.log('📋 Step 1: Checking current labels...');
    const existingLabels = await client.query('SELECT id, title FROM labels ORDER BY id');
    console.log(`   Found ${existingLabels.rows.length} existing labels`);

    if (existingLabels.rows.length > 0) {
      console.log('   Current IDs:', existingLabels.rows.map(r => r.id).join(', '));
    }
    console.log('');

    // Step 2: Delete all labels
    console.log('🗑️  Step 2: Deleting all labels...');
    const deleteResult = await client.query('DELETE FROM labels');
    console.log(`   ✅ Deleted ${deleteResult.rowCount} labels\n`);

    // Step 3: Reset sequence
    console.log('🔄 Step 3: Resetting sequence to start from 1...');
    await client.query('ALTER SEQUENCE labels_id_seq RESTART WITH 1');
    console.log('   ✅ Sequence reset\n');

    // Step 4: Create labels via API (to ensure proper initialization)
    console.log('🔨 Step 4: Creating labels with correct IDs...\n');

    const createdLabels = [];

    for (const label of LABELS) {
      try {
        process.stdout.write(`   Creating ${label.title} (expecting ID ${label.id})...`);

        // Create via API
        const response = await fetch(`${VIKUNJA_API_URL}/labels`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: label.title,
            description: label.desc,
            hex_color: label.color
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API error: ${error}`);
        }

        const created = await response.json();

        // Verify ID matches
        if (created.id === label.id) {
          process.stdout.write(` ✅ ID ${created.id} (correct)\n`);
          createdLabels.push(created);
        } else {
          process.stdout.write(` ⚠️  ID ${created.id} (expected ${label.id})\n`);
        }

        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        process.stdout.write(` ❌ Failed: ${error.message}\n`);
      }
    }

    console.log('');
    console.log('=' .repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${createdLabels.length} of ${LABELS.length} labels`);

    // Verify final state
    const finalLabels = await client.query('SELECT id, title FROM labels ORDER BY id');
    console.log('\n🏷️  Final Label IDs:');
    finalLabels.rows.forEach(row => {
      console.log(`   ID ${row.id}: ${row.title}`);
    });

    // Check if all IDs are correct
    const allCorrect = createdLabels.every(l => {
      const expected = LABELS.find(e => e.title === l.title);
      return expected && expected.id === l.id;
    });

    if (allCorrect && createdLabels.length === LABELS.length) {
      console.log(`\n🎉 SUCCESS! All labels created with correct IDs (1-${LABELS.length})`);
      console.log('\nNext steps:');
      console.log(`1. Update vikunja-service.ts with new IDs (1-${LABELS.length})`);
      console.log('2. Restart your application server');
      console.log('3. Test creating a new issue report');
    } else {
      console.log('\n⚠️  WARNING: Some labels may have incorrect IDs');
      console.log('   You may need to manually update the code mapping');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused. Make sure:');
      console.log('   1. PostgreSQL database is running');
      console.log('   2. DATABASE_URL is correct in .env');
      console.log('   3. Database accepts connections from this host');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
