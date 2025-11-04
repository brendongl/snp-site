/**
 * Test script to verify the complete Issue Resolution workflow:
 * 1. Fetch Board Game Issues tasks
 * 2. Find the "Scotland Yard" task
 * 3. Complete it via API
 * 4. Verify points awarded
 * 5. Verify changelog entry created
 * 6. Verify task removed from list
 */

const { Pool } = require('pg');

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

async function testCompleteWorkflow() {
  console.log('='.repeat(80));
  console.log('TESTING ISSUE RESOLUTION WORKFLOW');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Fetch all incomplete tasks from project 25
    console.log('Step 1: Fetching Board Game Issues tasks...');
    const tasksResponse = await fetch(`${VIKUNJA_URL}/projects/25/tasks`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`
      }
    });

    if (!tasksResponse.ok) {
      throw new Error(`Failed to fetch tasks: ${tasksResponse.status}`);
    }

    const allTasks = await tasksResponse.json();
    const incompleteTasks = allTasks.filter(t => !t.done);

    console.log(`✅ Found ${incompleteTasks.length} incomplete tasks`);
    console.log('');

    // Display all incomplete tasks
    console.log('Incomplete tasks:');
    incompleteTasks.forEach((task, i) => {
      console.log(`  ${i + 1}. [ID: ${task.id}] ${task.title}`);
    });
    console.log('');

    // Step 2: Find Scotland Yard task
    console.log('Step 2: Looking for "Scotland Yard" task...');
    let scotlandYardTask = incompleteTasks.find(t => t.title.includes('Scotland Yard'));

    if (!scotlandYardTask) {
      console.log('❌ Scotland Yard task not found (may have been completed already)');
      console.log('Creating a new test task...');

      // Create a test task
      const createResponse = await fetch(`${VIKUNJA_URL}/projects/25/tasks`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'broken_sleeves - Scotland Yard (TEST)',
          description: '**Issue:** Card sleeves are torn\n**Game:** Scotland Yard',
          project_id: 25,
          due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
          priority: 3,
          labels: [{ id: 4 }] // points:1000
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create test task: ${createResponse.status}`);
      }

      const newTask = await createResponse.json();
      console.log(`✅ Created test task with ID: ${newTask.id}`);

      // Use the new task for testing
      scotlandYardTask = newTask;
    } else {
      console.log(`✅ Found task: ${scotlandYardTask.title} (ID: ${scotlandYardTask.id})`);
    }
    console.log('');

    // Step 3: Get initial points for Brendon
    console.log('Step 3: Getting initial staff points...');
    const staffId = 'c1ec6db5-e14a-414a-b70e-88a6cc0d8250'; // Brendon's UUID

    const initialStaffResult = await pool.query(
      'SELECT staff_name, points FROM staff_list WHERE id = $1',
      [staffId]
    );

    if (initialStaffResult.rows.length === 0) {
      throw new Error('Staff member not found');
    }

    const initialPoints = initialStaffResult.rows[0].points;
    const staffName = initialStaffResult.rows[0].staff_name;

    console.log(`✅ Staff: ${staffName}, Initial Points: ${initialPoints}`);
    console.log('');

    // Step 4: Complete the task via local API endpoint
    console.log('Step 4: Completing task via API endpoint...');
    const completeResponse = await fetch('http://localhost:3001/api/vikunja/tasks/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        taskId: scotlandYardTask.id,
        staffId: staffId,
        points: 1000
      })
    });

    if (!completeResponse.ok) {
      const errorText = await completeResponse.text();
      throw new Error(`Failed to complete task: ${completeResponse.status} - ${errorText}`);
    }

    const completeResult = await completeResponse.json();
    console.log(`✅ Task completed successfully`);
    console.log(`   Points awarded: ${completeResult.staff.pointsAwarded}`);
    console.log(`   New total: ${completeResult.staff.points}`);
    console.log('');

    // Step 5: Verify points in database
    console.log('Step 5: Verifying points in database...');
    const updatedStaffResult = await pool.query(
      'SELECT points FROM staff_list WHERE id = $1',
      [staffId]
    );

    const newPoints = updatedStaffResult.rows[0].points;
    const pointsAdded = newPoints - initialPoints;

    if (pointsAdded === 1000) {
      console.log(`✅ Points verified: ${initialPoints} → ${newPoints} (+${pointsAdded})`);
    } else {
      console.log(`❌ Point mismatch: Expected +1000, got +${pointsAdded}`);
    }
    console.log('');

    // Step 6: Check changelog entry
    console.log('Step 6: Checking changelog entry...');
    const changelogResult = await pool.query(`
      SELECT id, points_awarded, point_category, description, created_at
      FROM changelog
      WHERE staff_id = $1
        AND point_category = 'task_complete'
      ORDER BY created_at DESC
      LIMIT 1
    `, [staffId]);

    if (changelogResult.rows.length > 0) {
      const entry = changelogResult.rows[0];
      console.log(`✅ Changelog entry found:`);
      console.log(`   ID: ${entry.id}`);
      console.log(`   Points: ${entry.points_awarded}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   Created: ${entry.created_at}`);
    } else {
      console.log(`❌ No changelog entry found for task completion`);
    }
    console.log('');

    // Step 7: Verify task is marked complete in Vikunja
    console.log('Step 7: Verifying task status in Vikunja...');
    const taskCheckResponse = await fetch(`${VIKUNJA_URL}/tasks/${scotlandYardTask.id}`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`
      }
    });

    if (taskCheckResponse.ok) {
      const task = await taskCheckResponse.json();
      if (task.done) {
        console.log(`✅ Task is marked as complete in Vikunja`);
        console.log(`   Completed at: ${task.done_at}`);
      } else {
        console.log(`❌ Task is NOT marked as complete in Vikunja`);
      }
    }
    console.log('');

    // Step 8: Verify task no longer appears in Board Game Issues
    console.log('Step 8: Verifying task removed from incomplete list...');
    const finalTasksResponse = await fetch(`${VIKUNJA_URL}/projects/25/tasks`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`
      }
    });

    const finalAllTasks = await finalTasksResponse.json();
    const finalIncompleteTasks = finalAllTasks.filter(t => !t.done);
    const stillInList = finalIncompleteTasks.find(t => t.id === scotlandYardTask.id);

    if (!stillInList) {
      console.log(`✅ Task successfully removed from incomplete tasks list`);
      console.log(`   Remaining incomplete tasks: ${finalIncompleteTasks.length}`);
    } else {
      console.log(`❌ Task still appears in incomplete tasks list`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Task ID: ${scotlandYardTask.id}`);
    console.log(`Staff: ${staffName} (${staffId})`);
    console.log(`Points: ${initialPoints} → ${newPoints} (+${pointsAdded})`);
    console.log(`Changelog: ${changelogResult.rows.length > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log(`Task Status: ${!stillInList ? '✅ Complete' : '❌ Still Incomplete'}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testCompleteWorkflow();
