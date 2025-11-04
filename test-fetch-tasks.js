const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;

async function testFetchTasks() {
  try {
    console.log('Fetching tasks from project 25...\n');
    const response = await fetch(`${VIKUNJA_URL}/projects/25/tasks`, {
      headers: {
        'Authorization': `Bearer ${VIKUNJA_TOKEN}`
      }
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response type:', typeof text);
    console.log('Response:', text.substring(0, 500));

    if (response.ok) {
      const json = JSON.parse(text);
      console.log('\nParsed as:', typeof json);
      console.log('Is array:', Array.isArray(json));
      console.log('Length:', json?.length);
      console.log('Tasks found:', json?.length || 0);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFetchTasks();
