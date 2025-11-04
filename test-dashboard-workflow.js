/**
 * Test the actual dashboard workflow:
 * 1. Fetch board game issues
 * 2. Complete one task
 * 3. Re-fetch and verify it's gone
 * 4. Verify points awarded
 * 5. Verify changelog entry
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const staffId = 'c1ec6db5-e14a-414a-b70e-88a6cc0d8250'; // Brendon

async function testDashboardWorkflow() {
  console.log('='.repeat(80));
  console.log('TESTING DASHBOARD WORKFLOW (AS USER WOULD EXPERIENCE)');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Fetch board game issues (as dashboard does)
    console.log('Step 1: Fetching board game issues (initial state)...');
    let response = await fetch('http://localhost:3001/api/vikunja/board-game-issues');
    let data = await response.json();

    console.log(`✅ Found ${data.count} tasks:`);
    data.tasks.forEach((task, i) => {
      console.log(`  ${i + 1}. [ID: ${task.id}] ${task.title} (${task.points} pts)`);
    });
    console.log('');

    if (data.count === 0) {
      console.log('❌ No tasks to test with!');
      return;
    }

    const taskToComplete = data.tasks[0];
    console.log(`Selected task to complete: ${taskToComplete.title} (ID: ${taskToComplete.id})`);
    console.log('');

    // Step 2: Get initial points
    console.log('Step 2: Getting initial staff points...');
    const initialStaffResult = await pool.query(
      'SELECT staff_name, points FROM staff_list WHERE id = $1',
      [staffId]
    );
    const initialPoints = initialStaffResult.rows[0].points;
    const staffName = initialStaffResult.rows[0].staff_name;
    console.log(`✅ ${staffName}: ${initialPoints} points`);
    console.log('');

    // Step 3: Complete the task (as dashboard button does)
    console.log('Step 3: Clicking "Resolve" button (completing task)...');
    const completeResponse = await fetch('http://localhost:3001/api/vikunja/tasks/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: taskToComplete.id,
        staffId: staffId,
        points: taskToComplete.points || 500 // Use task points or default
      })
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.text();
      console.log(`❌ Failed to complete task: ${error}`);
      return;
    }

    const completeResult = await completeResponse.json();
    console.log(`✅ Task completed successfully`);
    console.log(`   Points awarded: ${completeResult.staff.pointsAwarded}`);
    console.log(`   New total: ${completeResult.staff.points}`);
    console.log('');

    // Step 4: Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Re-fetch board game issues (as dashboard refetch does)
    console.log('Step 4: Re-fetching board game issues (simulating dashboard refresh)...');
    response = await fetch('http://localhost:3001/api/vikunja/board-game-issues');
    data = await response.json();

    console.log(`✅ Now showing ${data.count} tasks:`);
    data.tasks.forEach((task, i) => {
      console.log(`  ${i + 1}. [ID: ${task.id}] ${task.title} (${task.points} pts)`);
    });
    console.log('');

    const stillInList = data.tasks.find(t => t.id === taskToComplete.id);
    if (stillInList) {
      console.log(`❌ FAILED: Task ${taskToComplete.id} still appears in list!`);
    } else {
      console.log(`✅ SUCCESS: Task ${taskToComplete.id} removed from list`);
    }
    console.log('');

    // Step 6: Verify points in database
    console.log('Step 5: Verifying points in database...');
    const updatedStaffResult = await pool.query(
      'SELECT points FROM staff_list WHERE id = $1',
      [staffId]
    );
    const newPoints = updatedStaffResult.rows[0].points;
    const pointsAdded = newPoints - initialPoints;

    console.log(`✅ Points updated: ${initialPoints} → ${newPoints} (+${pointsAdded})`);
    console.log('');

    // Step 7: Verify changelog entry
    console.log('Step 6: Verifying changelog entry...');
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
      console.log(`   Points: ${entry.points_awarded}`);
      console.log(`   Description: ${entry.description}`);
    } else {
      console.log(`❌ No changelog entry found`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('DASHBOARD WORKFLOW TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Initial tasks: ${data.count + 1}`);
    console.log(`Tasks after completion: ${data.count}`);
    console.log(`Task removed from list: ${!stillInList ? '✅ YES' : '❌ NO'}`);
    console.log(`Points awarded: ${pointsAdded > 0 ? '✅ YES (+' + pointsAdded + ')' : '❌ NO'}`);
    console.log(`Changelog entry: ${changelogResult.rows.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testDashboardWorkflow();
