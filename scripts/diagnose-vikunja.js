/**
 * Vikunja Diagnostic Script
 *
 * Checks projects, permissions, and attempts to create a test task
 */

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const API_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

async function makeRequest(endpoint, options = {}) {
  const url = `${VIKUNJA_URL}${endpoint}`;
  console.log(`\n🔗 Request: ${options.method || 'GET'} ${url}`);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log(`📊 Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    console.error(`❌ Error Response:`, data);
    return { error: true, status: response.status, data };
  }

  return { error: false, data };
}

async function main() {
  console.log('🔍 VIKUNJA DIAGNOSTIC TEST');
  console.log('='.repeat(50));

  // 1. List all projects
  console.log('\n📁 STEP 1: List all projects');
  const projectsResult = await makeRequest('/projects');

  if (projectsResult.error) {
    console.error('Failed to list projects');
    return;
  }

  const projects = projectsResult.data;
  console.log(`✅ Found ${projects.length} project(s):`);
  projects.forEach(p => {
    console.log(`\n  Project ID: ${p.id}`);
    console.log(`  Title: "${p.title}"`);
    console.log(`  Is Archived: ${p.is_archived || false}`);
    console.log(`  Owner ID: ${p.owner?.id || 'N/A'}`);
  });

  // 2. Find Staff Tasks project
  console.log('\n\n📋 STEP 2: Check Staff Tasks project');
  const staffProject = projects.find(p => p.title.includes('Staff Tasks'));

  if (!staffProject) {
    console.error('❌ No "Staff Tasks" project found!');
    console.log('Available projects:', projects.map(p => p.title).join(', '));
    return;
  }

  console.log(`✅ Found "Staff Tasks" project (ID: ${staffProject.id})`);

  // 3. Get detailed project info
  console.log('\n\n🔍 STEP 3: Get detailed project information');
  const detailResult = await makeRequest(`/projects/${staffProject.id}`);

  if (detailResult.error) {
    console.error('Failed to get project details');
    return;
  }

  const projectDetails = detailResult.data;
  console.log('📝 Project Details:');
  console.log(`  ID: ${projectDetails.id}`);
  console.log(`  Title: ${projectDetails.title}`);
  console.log(`  Description: ${projectDetails.description || '(none)'}`);
  console.log(`  Is Archived: ${projectDetails.is_archived || false}`);
  console.log(`  Created: ${projectDetails.created}`);
  console.log(`  Updated: ${projectDetails.updated}`);
  console.log(`  Owner:`);
  console.log(`    - ID: ${projectDetails.owner?.id}`);
  console.log(`    - Username: ${projectDetails.owner?.username}`);
  console.log(`    - Name: ${projectDetails.owner?.name || '(not set)'}`);

  // 4. List existing tasks
  console.log('\n\n📝 STEP 4: List existing tasks in project');
  const tasksResult = await makeRequest(`/projects/${staffProject.id}/tasks`);

  if (tasksResult.error) {
    console.error('Failed to list tasks');
  } else {
    const tasks = tasksResult.data;
    console.log(`✅ Found ${tasks.length} task(s):`);
    tasks.slice(0, 10).forEach(t => {
      console.log(`  - [${t.done ? 'x' : ' '}] ${t.title} (ID: ${t.id})`);
    });
    if (tasks.length > 10) {
      console.log(`  ... and ${tasks.length - 10} more`);
    }
  }

  // 5. Try to create a test task
  console.log('\n\n✨ STEP 5: Attempting to create a test task');
  const testTask = {
    title: 'DIAGNOSTIC TEST TASK - DELETE ME',
    description: 'This is a test task created by the diagnostic script. You can safely delete this.',
    project_id: staffProject.id,
    done: false,
  };

  const createResult = await makeRequest('/tasks', {
    method: 'PUT',
    body: JSON.stringify(testTask),
  });

  if (createResult.error) {
    console.error('❌ FAILED TO CREATE TASK!');
    console.error('This is likely why you can\'t create tasks in the UI.');
    console.error('\nError details:');
    console.error(JSON.stringify(createResult.data, null, 2));

    if (createResult.status === 403) {
      console.error('\n⚠️  PERMISSION DENIED (403)');
      console.error('Your API token does not have write permissions to this project.');
      console.error('\nPossible fixes:');
      console.error('1. Create a new API token with admin/write permissions');
      console.error('2. Check if the token user is the project owner');
      console.error('3. Share the project with the token user (with write access)');
    }
  } else {
    console.log('✅ SUCCESS! Test task created successfully!');
    console.log(`   Task ID: ${createResult.data.id}`);
    console.log(`   Task Title: ${createResult.data.title}`);
    console.log('\n✨ Good news: The API can create tasks!');
    console.log('The UI issue might be:');
    console.log('  - Browser cache/cookies');
    console.log('  - Different user in UI vs API token');
    console.log('  - UI JavaScript error (check browser console)');

    // Try to delete the test task
    console.log('\n🗑️  Cleaning up: Deleting test task...');
    const deleteResult = await makeRequest(`/tasks/${createResult.data.id}`, {
      method: 'DELETE',
    });

    if (deleteResult.error) {
      console.warn('⚠️  Could not delete test task (you may need to delete it manually)');
    } else {
      console.log('✅ Test task deleted successfully');
    }
  }

  // 6. Summary
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Project exists: ${staffProject.title} (ID: ${staffProject.id})`);
  console.log(`✅ Project is archived: ${projectDetails.is_archived || false}`);
  console.log(`✅ Project owner: ${projectDetails.owner?.username || 'Unknown'}`);
  console.log(`${createResult.error ? '❌' : '✅'} Can create tasks via API: ${!createResult.error}`);

  if (createResult.error) {
    console.log('\n⚠️  NEXT STEPS:');
    console.log('1. Check your user account permissions in Vikunja UI');
    console.log('2. Try creating a new project where you are the owner');
    console.log('3. Generate a new API token with admin permissions');
    console.log('4. Check if you\'re logged in as the same user in UI and API');
  } else {
    console.log('\n✨ API is working! Check browser console for UI errors.');
  }
}

main().catch(error => {
  console.error('❌ Fatal Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
