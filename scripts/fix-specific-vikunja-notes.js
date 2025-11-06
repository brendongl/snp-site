/**
 * Manually fix specific Vikunja observation notes
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

if (!VIKUNJA_TOKEN) {
  console.error('❌ VIKUNJA_API_TOKEN not set in environment');
  process.exit(1);
}

async function getTask(taskId) {
  const response = await fetch(`${VIKUNJA_URL}/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch task: ${response.status}`);
  }

  return await response.json();
}

async function updateTask(taskId, newDescription) {
  const response = await fetch(`${VIKUNJA_URL}/tasks/${taskId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: newDescription
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update task: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function main() {
  // Task 175: "Missing Pieces - Rory's Story Cubes: Actions"
  console.log('📝 Fixing task 175...');
  const task175 = await getTask(175);
  console.log('Current description:', task175.description);

  const new175 = `Missing: test missing piece
Brendon Gan-Le reported it on Nov 6, 2025.`;

  await updateTask(175, new175);
  console.log('✅ Task 175 fixed');

  // Task 173: "missing pieces - Dead of Winter: A Crossroads Game"
  console.log('\n📝 Fixing task 173...');
  const task173 = await getTask(173);
  console.log('Current description:', task173.description);

  const new173 = `Missing: test where is this in the description?
Thịnh Văn Hoàng Vũ reported it on Nov 6, 2025.`;

  await updateTask(173, new173);
  console.log('✅ Task 173 fixed');

  // Task 138 (also had issues)
  console.log('\n📝 Checking task 138...');
  const task138 = await getTask(138);
  console.log('Current description:', task138.description);

  if (task138.description.includes('**')) {
    console.log('Task 138 needs fixing');
    // Extract the actual note from whatever format it's in
    const noteMatch = task138.description.match(/test\s+(.+?)(?:\*\*|$)/i);
    const note = noteMatch ? noteMatch[0].trim() : 'observation note';

    const new138 = `Missing: ${note}
Brendon Gan-Le reported it on Nov 6, 2025.`;

    await updateTask(138, new138);
    console.log('✅ Task 138 fixed');
  } else {
    console.log('✅ Task 138 already in good format');
  }

  // Task 118
  console.log('\n📝 Checking task 118...');
  const task118 = await getTask(118);
  console.log('Current description:', task118.description);

  if (task118.description.includes('**')) {
    console.log('Task 118 needs fixing - checking format...');
    const noteMatch = task118.description.match(/\*\*Note:\*\*\s*(.+?)\s*\*\*Reported/);
    if (noteMatch) {
      const note = noteMatch[1].trim();
      const reporterMatch = task118.description.match(/\*\*Reported by:\*\*\s*(.+?)(?:\s*\*\*|$)/);
      const reporter = reporterMatch ? reporterMatch[1].trim() : 'Unknown';

      const new118 = `Missing: ${note}
${reporter} reported it on Nov 6, 2025.`;

      await updateTask(118, new118);
      console.log('✅ Task 118 fixed');
    }
  } else {
    console.log('✅ Task 118 already in good format');
  }

  console.log('\n✅ All tasks fixed!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
