/**
 * Create Staff Tasks Project
 */

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const API_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

async function createProject() {
  console.log('Creating "Staff Tasks" project...\n');

  const response = await fetch(`${VIKUNJA_URL}/projects`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Staff Tasks',
      description: 'Sip N Play staff task management with points system',
      is_archived: false,
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Failed to create project:', data);
    process.exit(1);
  }

  console.log('✅ Project created successfully!');
  console.log(`   Project ID: ${data.id}`);
  console.log(`   Title: ${data.title}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Update lib/services/vikunja-service.ts line 137:`);
  console.log(`      Change: getPriorityTasks(projectId: number = 2)`);
  console.log(`      To:     getPriorityTasks(projectId: number = ${data.id})`);
  console.log(`   2. Go to https://tasks.sipnplay.cafe and add tasks to "Staff Tasks"`);
}

createProject().catch(console.error);
