#!/usr/bin/env node
/**
 * Reset and recreate all Vikunja labels with correct IDs
 *
 * This script:
 * 1. Deletes ALL existing labels in Vikunja
 * 2. Creates labels with exact IDs expected by vikunja-service.ts
 * 3. Fills ID gaps with placeholder labels (e.g., ID 14 for points:2000)
 *
 * Expected IDs (hardcoded in vikunja-service.ts):
 * - Point labels: 1, 2, 3, 4, 5, 6, 7, 8, 14
 * - Issue type labels: 19, 20
 *
 * Run: node scripts/reset-vikunja-labels.js
 */

require('dotenv').config();

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

if (!VIKUNJA_TOKEN) {
  console.error('❌ VIKUNJA_API_TOKEN not found in environment variables');
  console.log('   Make sure .env has: VIKUNJA_API_TOKEN=tk_...');
  process.exit(1);
}

// Expected label configuration
const LABEL_CONFIG = [
  // ID 1-8: Point labels (standard values)
  { id: 1, title: 'points:100', color: '90EE90', desc: 'Simple quick task (5-15 min)' },
  { id: 2, title: 'points:200', color: '32CD32', desc: 'Minor task (15-30 min)' },
  { id: 3, title: 'points:500', color: '4169E1', desc: 'Standard task (30-60 min)' },
  { id: 4, title: 'points:1000', color: '1E90FF', desc: 'Medium effort task (1-2 hours)' },
  { id: 5, title: 'points:5000', color: '9370DB', desc: 'Major task (half day)' },
  { id: 6, title: 'points:10000', color: '8B008B', desc: 'Large project (full day)' },
  { id: 7, title: 'points:20000', color: 'FF8C00', desc: 'Major project (2-3 days)' },
  { id: 8, title: 'points:50000', color: 'FF4500', desc: 'Epic achievement (1+ week)' },

  // ID 9-13: Placeholders (required to reach ID 14)
  { id: 9, title: '__placeholder_9', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 10, title: '__placeholder_10', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 11, title: '__placeholder_11', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 12, title: '__placeholder_12', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 13, title: '__placeholder_13', color: 'CCCCCC', desc: 'Placeholder - do not use' },

  // ID 14: Complex game multiplier
  { id: 14, title: 'points:2000', color: '00CED1', desc: 'Complex game task (1000 × 2)' },

  // ID 15-18: More placeholders (required to reach ID 19)
  { id: 15, title: '__placeholder_15', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 16, title: '__placeholder_16', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 17, title: '__placeholder_17', color: 'CCCCCC', desc: 'Placeholder - do not use' },
  { id: 18, title: '__placeholder_18', color: 'CCCCCC', desc: 'Placeholder - do not use' },

  // ID 19-20: Issue type labels
  { id: 19, title: 'task', color: 'e74c3c', desc: 'Actionable issue (shows in dashboard, awards points)' },
  { id: 20, title: 'note', color: '95a5a6', desc: 'Non-actionable note (filtered, no points)' },
];

/**
 * Fetch all existing labels
 */
async function getAllLabels() {
  const response = await fetch(`${VIKUNJA_URL}/labels`, {
    headers: { 'Authorization': `Bearer ${VIKUNJA_TOKEN}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch labels: ${response.status}`);
  }

  return await response.json();
}

/**
 * Delete a label by ID
 */
async function deleteLabel(labelId) {
  const response = await fetch(`${VIKUNJA_URL}/labels/${labelId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${VIKUNJA_TOKEN}` }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete label ${labelId}: ${error}`);
  }
}

/**
 * Create a label
 */
async function createLabel(title, hexColor, description) {
  const response = await fetch(`${VIKUNJA_URL}/labels`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: title,
      description: description,
      hex_color: hexColor
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create label "${title}": ${error}`);
  }

  return await response.json();
}

/**
 * Main execution
 */
async function main() {
  console.log('🏷️  Vikunja Label Reset & Recreation');
  console.log('=' .repeat(60));
  console.log('');

  // Step 1: Fetch existing labels
  console.log('📋 Step 1: Fetching existing labels...');
  const existingLabels = await getAllLabels();
  console.log(`   Found ${existingLabels.length} existing labels\n`);

  // Step 2: Delete all existing labels
  if (existingLabels.length > 0) {
    console.log('🗑️  Step 2: Deleting all existing labels...');

    for (const label of existingLabels) {
      try {
        await deleteLabel(label.id);
        console.log(`   ✅ Deleted: ${label.title} (ID: ${label.id})`);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
      } catch (error) {
        console.error(`   ❌ Failed to delete ${label.title}:`, error.message);
      }
    }
    console.log('');
  } else {
    console.log('✨ Step 2: No existing labels to delete\n');
  }

  // Step 3: Create labels in order
  console.log('🔨 Step 3: Creating labels with correct IDs...\n');

  const createdLabels = [];
  let errors = 0;

  for (const config of LABEL_CONFIG) {
    try {
      const isPlaceholder = config.title.startsWith('__placeholder');
      const displayTitle = isPlaceholder ? `[Placeholder ${config.id}]` : config.title;

      process.stdout.write(`   Creating ${displayTitle}...`);

      const label = await createLabel(config.title, config.color, config.desc);

      // Verify ID matches expected
      if (label.id === config.id) {
        process.stdout.write(` ✅ ID ${label.id} (correct)\n`);
        createdLabels.push(label);
      } else {
        process.stdout.write(` ⚠️  ID ${label.id} (expected ${config.id})\n`);
        errors++;
      }

      await new Promise(resolve => setTimeout(resolve, 150)); // Rate limiting

    } catch (error) {
      process.stdout.write(` ❌ Failed\n`);
      console.error(`      Error: ${error.message}`);
      errors++;
    }
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${createdLabels.length} labels`);
  console.log(`   ❌ Errors: ${errors}`);

  if (errors === 0) {
    console.log('\n🎉 SUCCESS! All labels created with correct IDs');
  } else {
    console.log('\n⚠️  WARNING: Some labels may have incorrect IDs');
    console.log('   Check the output above for details');
  }

  // Display point labels
  console.log('\n💎 Point Labels (for staff tasks):');
  createdLabels
    .filter(l => l.title.startsWith('points:'))
    .sort((a, b) => {
      const aVal = parseInt(a.title.replace('points:', ''));
      const bVal = parseInt(b.title.replace('points:', ''));
      return aVal - bVal;
    })
    .forEach(l => {
      const points = l.title.replace('points:', '');
      console.log(`   ID ${l.id}: points:${points} - ${l.description}`);
    });

  // Display issue type labels
  console.log('\n🏷️  Issue Type Labels:');
  createdLabels
    .filter(l => ['task', 'note'].includes(l.title))
    .forEach(l => {
      console.log(`   ID ${l.id}: ${l.title} - ${l.description}`);
    });

  // Display placeholders
  const placeholders = createdLabels.filter(l => l.title.startsWith('__placeholder'));
  if (placeholders.length > 0) {
    console.log(`\n📦 Placeholder Labels: ${placeholders.length}`);
    console.log('   (These ensure correct ID sequencing - do not delete!)');
  }

  console.log('\n✅ Label reset complete!');
  console.log('\nNext steps:');
  console.log('1. Restart your application server');
  console.log('2. Test creating a new issue report');
  console.log('3. Verify the task has both point label and issue type label');
  console.log('');
}

// Run
main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
