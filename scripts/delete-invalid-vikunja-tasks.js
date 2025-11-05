/**
 * Delete Invalid Vikunja Tasks (Auto-confirm)
 *
 * Finds and deletes tasks with insufficient context without asking for confirmation.
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const BOARD_GAME_ISSUES_PROJECT_ID = 25;

async function main() {
  console.log('🔍 Fetching all tasks from Board Game Issues project...\n');

  if (!VIKUNJA_TOKEN) {
    console.error('❌ VIKUNJA_API_TOKEN not set in environment');
    process.exit(1);
  }

  try {
    // Fetch all tasks
    const response = await fetch(
      `${VIKUNJA_URL}/projects/${BOARD_GAME_ISSUES_PROJECT_ID}/tasks?per_page=200`,
      {
        headers: {
          'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to fetch tasks:', error);
      process.exit(1);
    }

    const allTasks = await response.json();
    console.log(`✅ Found ${allTasks.length} total tasks\n`);

    // Filter for tasks with insufficient context
    const invalidTasks = allTasks.filter(task => {
      if (task.done) return false;

      const description = task.description || '';
      const issueMatch = description.match(/\*\*Issue:\*\*\s*(.+?)\n/);
      if (!issueMatch) return false;

      const issueText = issueMatch[1].trim();

      // Invalid patterns
      return (
        issueText === 'missing.' ||
        issueText === 'missing' ||
        issueText === 'Missing: Ok' ||
        issueText === 'Missing: None' ||
        issueText === 'missing .' ||
        (issueText.length < 15 && issueText.toLowerCase().includes('missing'))
      );
    });

    console.log(`🎯 Found ${invalidTasks.length} tasks with insufficient context\n`);

    if (invalidTasks.length === 0) {
      console.log('✨ No invalid tasks found.');
      return;
    }

    // Display and delete
    let deleted = 0;
    let errors = 0;

    for (const task of invalidTasks) {
      const issueMatch = task.description.match(/\*\*Issue:\*\*\s*(.+?)\n/);
      const issueText = issueMatch ? issueMatch[1].trim() : 'N/A';

      console.log(`🗑️  Deleting Task #${task.id}: ${task.title}`);
      console.log(`   Issue: "${issueText}"`);

      try {
        const deleteResponse = await fetch(
          `${VIKUNJA_URL}/tasks/${task.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!deleteResponse.ok) {
          const error = await deleteResponse.text();
          console.error(`   ❌ Failed: ${error}\n`);
          errors++;
          continue;
        }

        console.log(`   ✅ Deleted successfully\n`);
        deleted++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`   ❌ Error:`, error.message, '\n');
        errors++;
      }
    }

    console.log('📊 Summary:');
    console.log(`   ✅ Deleted: ${deleted} tasks`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Cleanup complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
