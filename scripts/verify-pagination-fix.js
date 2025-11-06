/**
 * Verify that pagination fix works correctly
 * Should now fetch all tasks across multiple pages
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const PROJECT_ID = 25;

async function testPaginatedFetch() {
  console.log('🧪 Testing paginated task fetch...\n');

  let allTasks = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    console.log(`📄 Fetching page ${page}...`);

    const response = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks?per_page=50&page=${page}&sort_by=id&order_by=desc`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
    }

    const tasks = await response.json();
    console.log(`   Fetched ${tasks.length} tasks`);

    // Add tasks from this page
    allTasks = allTasks.concat(tasks);

    // Check pagination headers
    const totalPages = response.headers.get('x-pagination-total-pages');
    console.log(`   Total pages: ${totalPages}`);

    if (totalPages && parseInt(totalPages) > page) {
      page++;
    } else {
      hasMorePages = false;
      console.log('   ✅ No more pages\n');
    }
  }

  console.log(`📊 Total tasks fetched: ${allTasks.length}`);

  // Filter note tasks
  const noteTasks = allTasks.filter(task => {
    const hasNoteLabel = task.labels?.some(label => label.title === 'note');
    return hasNoteLabel && !task.done;
  });

  console.log(`📋 Active note tasks: ${noteTasks.length}`);

  // Show task ID range
  const taskIds = allTasks.map(t => t.id);
  console.log(`\n🎯 Task ID range:`);
  console.log(`   Lowest: ${Math.min(...taskIds)}`);
  console.log(`   Highest: ${Math.max(...taskIds)}`);

  console.log(`\n✅ SUCCESS: Fetched all ${allTasks.length} tasks across ${page} pages`);
  console.log(`   Note tasks should now show all ${noteTasks.length} observations`);
}

testPaginatedFetch().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
