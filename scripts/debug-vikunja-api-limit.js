/**
 * Debug why Vikunja API only returns 50 tasks when database has 64+ note tasks
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const PROJECT_ID = 25;

async function testAPIWithDifferentParams() {
  console.log('🧪 Testing Vikunja API with different parameters...\n');

  // Test 1: Default (no params)
  console.log('📍 Test 1: Default API call (no pagination params)');
  const response1 = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const data1 = await response1.json();
  console.log(`   Returned: ${data1.length} tasks`);
  console.log(`   Response headers:`);
  console.log(`     x-pagination-total-pages: ${response1.headers.get('x-pagination-total-pages')}`);
  console.log(`     x-pagination-total-count: ${response1.headers.get('x-pagination-result-count')}`);
  console.log(`     x-pagination-limit: ${response1.headers.get('x-pagination-limit')}\n`);

  // Test 2: With per_page=500
  console.log('📍 Test 2: per_page=500');
  const response2 = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks?per_page=500`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const data2 = await response2.json();
  console.log(`   Returned: ${data2.length} tasks`);
  console.log(`   Response headers:`);
  console.log(`     x-pagination-total-pages: ${response2.headers.get('x-pagination-total-pages')}`);
  console.log(`     x-pagination-total-count: ${response2.headers.get('x-pagination-result-count')}`);
  console.log(`     x-pagination-limit: ${response2.headers.get('x-pagination-limit')}\n`);

  // Test 3: With per_page=500 and filter
  console.log('📍 Test 3: per_page=500 & sort_by=id & order_by=desc');
  const response3 = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks?per_page=500&sort_by=id&order_by=desc`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const data3 = await response3.json();
  console.log(`   Returned: ${data3.length} tasks`);
  console.log(`   Response headers:`);
  console.log(`     x-pagination-total-pages: ${response3.headers.get('x-pagination-total-pages')}`);
  console.log(`     x-pagination-total-count: ${response3.headers.get('x-pagination-result-count')}`);
  console.log(`     x-pagination-limit: ${response3.headers.get('x-pagination-limit')}\n`);

  // Count note tasks in response
  const noteTasks = data3.filter(task => {
    const hasNoteLabel = task.labels?.some(label => label.id === 26 || label.title === 'note');
    return hasNoteLabel && !task.done;
  });
  console.log(`   Note tasks (not done): ${noteTasks.length}`);

  // Show all task IDs
  console.log(`\n📋 All task IDs returned (sorted by ID desc):`);
  const sortedTasks = data3.sort((a, b) => b.id - a.id);
  sortedTasks.forEach((task, i) => {
    const labels = task.labels?.map(l => l.title).join(', ') || 'no labels';
    const isDone = task.done ? ' [DONE]' : '';
    console.log(`   ${i + 1}. Task ${task.id}: "${task.title}" (${labels})${isDone}`);
  });

  // Show the range of IDs
  const taskIds = data3.map(t => t.id);
  console.log(`\n📊 Task ID range:`);
  console.log(`   Lowest: ${Math.min(...taskIds)}`);
  console.log(`   Highest: ${Math.max(...taskIds)}`);
  console.log(`   Total returned: ${taskIds.length}`);
}

testAPIWithDifferentParams().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
