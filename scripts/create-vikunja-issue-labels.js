/**
 * Create Vikunja labels for issue types
 * Part of v1.5.3 - Issue Reporting System Phase 3
 *
 * Creates two labels:
 * - "task" (actionable) - Shows in Staff Dashboard, awards points when resolved
 * - "note" (non-actionable) - Filtered from dashboard, no points awarded
 *
 * Run: node scripts/create-vikunja-issue-labels.js
 */

require('dotenv').config();

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const PROJECT_ID = 1; // "Sip n Play" project

async function createIssueLabels() {
  if (!VIKUNJA_TOKEN) {
    console.error('❌ VIKUNJA_API_TOKEN not found in environment variables');
    process.exit(1);
  }

  console.log('🔧 Creating Vikunja issue type labels...\n');

  const labels = [
    {
      title: 'task',
      description: 'Actionable issue that requires resolution (shows in dashboard, awards points)',
      hex_color: 'e74c3c', // Red - urgent/actionable
    },
    {
      title: 'note',
      description: 'Non-actionable note or observation (filtered from dashboard, no points)',
      hex_color: '95a5a6', // Gray - informational
    }
  ];

  const createdLabels = [];

  for (const label of labels) {
    try {
      console.log(`📝 Creating label: "${label.title}" (#${label.hex_color})`);

      const response = await fetch(`${VIKUNJA_URL}/labels`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(label)
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to create "${label.title}": ${error}`);
        continue;
      }

      const created = await response.json();
      createdLabels.push(created);
      console.log(`✅ Created label "${label.title}" (ID: ${created.id})`);
      console.log(`   Color: #${label.hex_color}`);
      console.log(`   Description: ${label.description}\n`);

    } catch (error) {
      console.error(`❌ Error creating label "${label.title}":`, error.message);
    }
  }

  // Display summary
  console.log('\n📊 Summary:');
  console.log(`✅ Created ${createdLabels.length} of ${labels.length} labels`);

  if (createdLabels.length > 0) {
    console.log('\n📋 Created Labels:');
    createdLabels.forEach(label => {
      console.log(`  - ${label.title} (ID: ${label.id}) - #${label.hex_color}`);
    });
  }

  console.log('\n✅ Label creation complete!');
  console.log('\nNext steps:');
  console.log('1. Verify labels in Vikunja UI');
  console.log('2. Update report issue endpoint to accept issueType parameter');
  console.log('3. Apply labels to tasks based on issueType');
}

// Run if called directly
if (require.main === module) {
  createIssueLabels().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}

module.exports = { createIssueLabels };
