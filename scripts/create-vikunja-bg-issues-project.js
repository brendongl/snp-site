/**
 * Create Vikunja "Board Game Issues" project
 * Part of v1.5.0 - Issue Reporting & Points System
 *
 * Creates a new project as a child of "Sip n Play" for tracking board game maintenance issues
 *
 * Run: node scripts/create-vikunja-bg-issues-project.js
 */

require('dotenv').config();

const VIKUNJA_API_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_API_TOKEN = process.env.VIKUNJA_API_TOKEN;

if (!VIKUNJA_API_TOKEN) {
  console.error('❌ Error: VIKUNJA_API_TOKEN not set in environment variables');
  process.exit(1);
}

async function createBoardGameIssuesProject() {
  try {
    console.log('🔧 Creating "Board Game Issues" project in Vikunja...');
    console.log(`📡 API URL: ${VIKUNJA_API_URL}`);

    // First, get the "Sip n Play" team/project ID
    console.log('\n🔍 Fetching existing projects...');
    const listResponse = await fetch(`${VIKUNJA_API_URL}/projects`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list projects: ${listResponse.status} ${listResponse.statusText}`);
    }

    const projects = await listResponse.json();
    console.log(`✅ Found ${projects.length} existing projects`);

    // Find "Sip n Play" project (should be ID 1 or 2)
    const sipnPlayProject = projects.find(p =>
      p.title.toLowerCase().includes('sip') || p.title.toLowerCase().includes('play')
    );

    if (!sipnPlayProject) {
      console.warn('⚠️  Could not find "Sip n Play" parent project');
      console.log('Available projects:');
      projects.forEach(p => console.log(`  - ${p.title} (ID: ${p.id})`));
      console.log('\n📝 Please specify parent project ID manually.');
      process.exit(1);
    }

    console.log(`✅ Found parent project: "${sipnPlayProject.title}" (ID: ${sipnPlayProject.id})`);

    // Check if "Board Game Issues" already exists
    const existingBgIssues = projects.find(p =>
      p.title.toLowerCase().includes('board game') && p.title.toLowerCase().includes('issues')
    );

    if (existingBgIssues) {
      console.log(`\n✅ "Board Game Issues" project already exists (ID: ${existingBgIssues.id})`);
      console.log(`\n📝 Add this to your .env file:`);
      console.log(`VIKUNJA_BG_ISSUES_PROJECT_ID=${existingBgIssues.id}`);
      return;
    }

    // Create new project
    console.log('\n🔧 Creating new "Board Game Issues" project...');

    const createResponse = await fetch(`${VIKUNJA_API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VIKUNJA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Board Game Issues',
        description: 'Actionable maintenance tasks for board games (re-sleeving, cleaning, organization, etc.)',
        parent_project_id: sipnPlayProject.id
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create project: ${createResponse.status} ${createResponse.statusText}\n${errorText}`);
    }

    const newProject = await createResponse.json();
    console.log(`✅ Created project: "${newProject.title}" (ID: ${newProject.id})`);

    // Display project details
    console.log('\n📋 Project details:');
    console.log(`  - ID: ${newProject.id}`);
    console.log(`  - Title: ${newProject.title}`);
    console.log(`  - Description: ${newProject.description}`);
    console.log(`  - Parent: ${sipnPlayProject.title} (ID: ${sipnPlayProject.id})`);

    // Show environment variable to add
    console.log(`\n📝 Add this to your .env file:`);
    console.log(`VIKUNJA_BG_ISSUES_PROJECT_ID=${newProject.id}`);

    console.log('\n✅ Vikunja project setup complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Add VIKUNJA_BG_ISSUES_PROJECT_ID to .env file (both local and Railway)');
    console.log('  2. Implement PointsService (lib/services/points-service.ts)');
    console.log('  3. Implement IssuesDbService (lib/services/issues-db-service.ts)');

  } catch (error) {
    console.error('❌ Error creating Vikunja project:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createBoardGameIssuesProject().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}

module.exports = { createBoardGameIssuesProject };
