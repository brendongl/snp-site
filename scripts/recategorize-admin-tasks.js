/**
 * Recategorize Admin tasks that should be in Maintenance
 */

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

const PROJECT_IDS = {
  ADMIN: 7,
  MAINTENANCE: 4,
  CLEANING: 3
};

async function vikunjaRequest(endpoint, method = 'GET', body = null) {
  const response = await fetch(`${VIKUNJA_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : null
  });
  return response.json();
}

function shouldBeInMaintenance(task) {
  const title = task.title.toLowerCase();
  const desc = (task.description || '').toLowerCase();
  const combined = title + ' ' + desc;

  return (
    combined.includes('ac cleaning') ||
    combined.includes('ps4') && combined.includes('cleaning') ||
    combined.includes('ps5') && combined.includes('cleaning') ||
    combined.includes('fire alarm') ||
    combined.includes('iknow')
  );
}

function shouldBeInCleaning(task) {
  const title = task.title.toLowerCase();
  return title.includes('clean kitchen fan');
}

async function main() {
  console.log('🔄 Recategorizing Admin tasks...\n');

  // Get all admin tasks
  const adminTasks = await vikunjaRequest(`/projects/${PROJECT_IDS.ADMIN}/tasks?per_page=500`);
  console.log(`Found ${adminTasks.length} tasks in Admin project\n`);

  let movedToMaintenance = 0;
  let movedToCleaning = 0;

  for (const task of adminTasks) {
    if (shouldBeInMaintenance(task)) {
      console.log(`→ Moving to Maintenance: "${task.title}"`);
      await vikunjaRequest(`/tasks/${task.id}`, 'POST', {
        project_id: PROJECT_IDS.MAINTENANCE
      });
      movedToMaintenance++;
      await new Promise(r => setTimeout(r, 200));
    } else if (shouldBeInCleaning(task)) {
      console.log(`→ Moving to Cleaning: "${task.title}"`);
      await vikunjaRequest(`/tasks/${task.id}`, 'POST', {
        project_id: PROJECT_IDS.CLEANING
      });
      movedToCleaning++;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\n✅ Recategorization complete!`);
  console.log(`   Moved to Maintenance: ${movedToMaintenance}`);
  console.log(`   Moved to Cleaning: ${movedToCleaning}`);
  console.log(`   Remaining in Admin: ${adminTasks.length - movedToMaintenance - movedToCleaning}`);
}

main().catch(console.error);
