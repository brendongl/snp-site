/**
 * Clean Invalid Vikunja Tasks
 *
 * This script finds and deletes tasks in the Board Game Issues project
 * that have insufficient context (e.g., just "missing." with no details).
 *
 * Run: node scripts/clean-invalid-vikunja-tasks.js
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
    // Fetch all tasks from Board Game Issues project
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
    // Pattern: "**Issue:** missing." or "**Issue:** missing " with no real details
    const invalidTasks = allTasks.filter(task => {
      if (task.done) return false; // Skip completed tasks

      const description = task.description || '';

      // Check if the issue description is just "missing" with no context
      const issueMatch = description.match(/\*\*Issue:\*\*\s*(.+?)\n/);
      if (!issueMatch) return false;

      const issueText = issueMatch[1].trim();

      // Consider invalid if:
      // 1. Just "missing." or "missing"
      // 2. Very short (< 15 characters) and contains "missing"
      // 3. No specific details about what's missing
      if (issueText === 'missing.' ||
          issueText === 'missing' ||
          (issueText.length < 15 && issueText.toLowerCase().includes('missing'))) {
        return true;
      }

      return false;
    });

    console.log(`🎯 Found ${invalidTasks.length} tasks with insufficient context\n`);

    if (invalidTasks.length === 0) {
      console.log('✨ No invalid tasks found. All tasks have proper context.');
      return;
    }

    // Display invalid tasks
    console.log('📋 Invalid tasks to be deleted:\n');
    invalidTasks.forEach((task, index) => {
      const issueMatch = task.description.match(/\*\*Issue:\*\*\s*(.+?)\n/);
      const issueText = issueMatch ? issueMatch[1].trim() : 'N/A';
      console.log(`${index + 1}. Task #${task.id}: ${task.title}`);
      console.log(`   Issue: "${issueText}"`);
      console.log(`   URL: https://tasks.sipnplay.cafe/tasks/${task.id}\n`);
    });

    // Prompt for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question(`⚠️  Delete these ${invalidTasks.length} tasks? (yes/no): `, resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled. No tasks deleted.');
      return;
    }

    // Delete tasks
    let deleted = 0;
    let errors = 0;

    console.log('\n🗑️  Deleting invalid tasks...\n');

    for (const task of invalidTasks) {
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
          console.error(`❌ Failed to delete task #${task.id}: ${error}`);
          errors++;
          continue;
        }

        console.log(`✅ Deleted task #${task.id}: ${task.title}`);
        deleted++;

        // Rate limiting: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error deleting task #${task.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Deleted: ${deleted} tasks`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Cleanup complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
