/**
 * Update all Vikunja observation notes to natural language format
 *
 * Old format (markdown):
 * **Note:** something is missing
 * **Reported by:** Brendon Gan-Le
 * **Game ID:** rec1234...
 * **Complexity:** 1.5
 *
 * New format (natural language):
 * Missing: something is missing
 * Brendon Gan-Le reported it on Nov 6, 2025.
 */

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const PROJECT_ID = 25; // Board Game Issues project
const NOTE_LABEL_ID = 26; // "note" label

if (!VIKUNJA_TOKEN) {
  console.error('❌ VIKUNJA_API_TOKEN not set in environment');
  process.exit(1);
}

async function fetchAllTasks() {
  const response = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks?per_page=500&sort_by=id&order_by=desc`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function parseOldFormat(description) {
  // Remove HTML tags if present
  let cleanDesc = description.replace(/<\/?p>/g, '');

  // Extract note/issue description
  const noteMatch = cleanDesc.match(/\*\*(?:Note|Issue):\*\*\s*(.+?)\s*\*\*Reported by:\*\*/);
  const note = noteMatch ? noteMatch[1].trim() : null;

  // Extract reporter (stop at **Game ID:** or end of line)
  const reporterMatch = cleanDesc.match(/\*\*Reported by:\*\*\s*(.+?)(?:\s*\*\*Game ID:\*\*|\n|$)/);
  const reporter = reporterMatch ? reporterMatch[1].trim() : 'Unknown';

  return { note, reporter };
}

function generateNewDescription(issueCategory, note, reporter, createdDate) {
  // Convert ISO date to readable format (e.g., "Nov 6, 2025")
  const date = new Date(createdDate);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Generate category-specific description based on issue category
  const categoryDescriptions = {
    'missing_pieces': `Missing: ${note}`,
    'broken_components': `Broken components: ${note}`,
    'component_wear': `Component wear: ${note}`,
    'staining': `Staining: ${note}`,
    'water_damage': `Water damage: ${note}`,
    'other_observation': note
  };

  const firstLine = categoryDescriptions[issueCategory] || note;
  const secondLine = `${reporter} reported it on ${formattedDate}.`;

  return `${firstLine}\n${secondLine}`;
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
    throw new Error(`Failed to update task ${taskId}: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function main() {
  console.log('🔄 Fetching all tasks from Vikunja...');
  const allTasks = await fetchAllTasks();

  // Filter to only tasks with "note" label
  const noteTasks = allTasks.filter(task => {
    const hasNoteLabel = task.labels?.some(label => label.id === NOTE_LABEL_ID);
    return hasNoteLabel && !task.done;
  });

  console.log(`📋 Found ${noteTasks.length} observation note tasks to update`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const task of noteTasks) {
    try {
      // Check if already in new format (no markdown and no HTML tags)
      if (!task.description.includes('**') && !task.description.includes('<p>')) {
        console.log(`⏭️  Task ${task.id} already in new format, skipping`);
        skippedCount++;
        continue;
      }

      // Extract issue category from title
      const titleMatch = task.title.match(/^(.+?)\s*-\s*(.+)$/);
      const issueCategory = titleMatch
        ? titleMatch[1].trim().toLowerCase().replace(/\s+/g, '_')
        : 'other_observation';

      // Parse old format
      const { note, reporter } = parseOldFormat(task.description);

      if (!note) {
        console.log(`⚠️  Task ${task.id} has no parseable note, skipping`);
        skippedCount++;
        continue;
      }

      // Generate new description
      const newDescription = generateNewDescription(
        issueCategory,
        note,
        reporter,
        task.created
      );

      console.log(`\n📝 Updating task ${task.id}: "${task.title}"`);
      console.log(`   Old: ${task.description.substring(0, 50)}...`);
      console.log(`   New: ${newDescription}`);

      // Update task
      await updateTask(task.id, newDescription);
      updatedCount++;
      console.log(`✅ Task ${task.id} updated successfully`);

      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error updating task ${task.id}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updatedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
