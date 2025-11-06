/**
 * Check how many note tasks exist in Vikunja vs displayed on frontend
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const PROJECT_ID = 25;

async function checkVikunjaTasks() {
  console.log('📊 Checking Vikunja tasks...\n');

  // Fetch all tasks from Vikunja
  const response = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks?per_page=500&sort_by=id&order_by=desc`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const allTasks = await response.json();

  // Filter note tasks
  const noteTasks = allTasks.filter(task => {
    const hasNoteLabel = task.labels?.some(label => label.title === 'note');
    return hasNoteLabel && !task.done;
  });

  console.log(`✅ Total tasks fetched: ${allTasks.length}`);
  console.log(`✅ Note tasks (not done): ${noteTasks.length}`);
  console.log(`\nNote task IDs (newest to oldest):`);
  noteTasks.forEach((task, i) => {
    console.log(`  ${i + 1}. Task ${task.id}: "${task.title}"`);
  });

  return noteTasks;
}

async function checkFrontendAPI() {
  console.log('\n\n📊 Checking frontend API response...\n');

  // Check what the frontend API returns
  const response = await fetch('http://localhost:3000/api/vikunja/observation-notes');
  const data = await response.json();

  console.log(`✅ Frontend API returned: ${data.count} issues`);
  console.log(`\nIssue IDs (from API):`);
  data.issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. Task ${issue.id}: "${issue.gameName}"`);
  });

  return data.issues;
}

async function main() {
  const vikunjaTasks = await checkVikunjaTasks();
  const frontendIssues = await checkFrontendAPI();

  console.log('\n\n🔍 COMPARISON:');
  console.log(`   Vikunja has: ${vikunjaTasks.length} note tasks`);
  console.log(`   Frontend shows: ${frontendIssues.length} issues`);

  if (vikunjaTasks.length !== frontendIssues.length) {
    console.log(`\n⚠️  MISMATCH: ${vikunjaTasks.length - frontendIssues.length} tasks missing from frontend!`);

    // Find which tasks are missing
    const frontendIds = new Set(frontendIssues.map(i => i.id));
    const missingTasks = vikunjaTasks.filter(t => !frontendIds.has(t.id.toString()));

    if (missingTasks.length > 0) {
      console.log(`\n❌ Missing tasks from frontend:`);
      missingTasks.forEach(task => {
        console.log(`   - Task ${task.id}: "${task.title}"`);
      });
    }
  } else {
    console.log(`\n✅ Counts match!`);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
