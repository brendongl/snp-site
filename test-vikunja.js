const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

async function testCreateTask() {
  try {
    // First, list all labels to see what point labels exist
    console.log('Listing all labels...\n');
    const labelsResponse = await fetch(`${VIKUNJA_URL}/labels`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`
      }
    });

    if (labelsResponse.ok) {
      const labels = await labelsResponse.json();
      console.log('Available labels:');
      const pointLabels = labels.filter(l => l.title.startsWith('points:'));
      pointLabels.forEach(l => {
        console.log(`  - ID: ${l.id}, Title: ${l.title}`);
      });
      console.log('');
    }

    // Try creating a task with full fields
    console.log('Testing task creation in project 25 with full fields...');
    let response = await fetch(`${VIKUNJA_URL}/projects/25/tasks`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Test Task - broken_sleeves - Pandemic',
        description: `**Issue:** Card sleeves are torn

**Reported by:** Test Staff
**Game ID:** test123
**Complexity:** 3

Complete this task to resolve the issue and earn 1000 points!`,
        project_id: 25,
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        priority: 3,
        assignees: [{ id: 1 }],
        labels: [{ id: 4 }] // points:1000 label
      })
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response body:', text);

    if (!response.ok) {
      console.log('\n❌ API call failed!');
    } else {
      console.log('\n✅ API call succeeded!');
      const json = JSON.parse(text);
      console.log('Created task ID:', json.id);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testCreateTask();
