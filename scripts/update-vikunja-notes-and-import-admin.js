/**
 * Update Vikunja Tasks with Notes and Import Admin Tasks
 *
 * This script will:
 * 1. Update existing tasks with notes from stafftasks.txt
 * 2. Import admin tasks with notes from admin tasks.txt
 */

const fs = require('fs');
const path = require('path');

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

// Project IDs (from previous script run)
const PROJECT_IDS = {
  PARENT: 2, // Sip n Play
  CLEANING: 3,
  MAINTENANCE: 4,
  ADMIN: 7,
  INVENTORY: 8,
  EVENTS: 9
};

/**
 * Make API request to Vikunja
 */
async function vikunjaRequest(endpoint, method = 'GET', body = null) {
  const url = `${VIKUNJA_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vikunja API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Parse Microsoft To-Do format tasks from text file
 */
function parseMicrosoftTodoFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const tasks = [];
  let currentTask = null;
  let collectingNotes = false;
  let noteBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Stop at Completed section
    if (trimmed === 'Completed') {
      if (currentTask) {
        currentTask.notes = noteBuffer.join('\n').trim();
        tasks.push(currentTask);
      }
      break;
    }

    // Skip empty lines and header
    if (!trimmed || i === 0) continue;

    // Main task line (starts with ⬜ or ✅ at beginning)
    if (/^[⬜✅]\s/.test(line)) {
      // Save previous task
      if (currentTask) {
        currentTask.notes = noteBuffer.join('\n').trim();
        tasks.push(currentTask);
      }

      // Extract task details
      const done = line.startsWith('✅');
      let taskLine = line.replace(/^[⬜✅]\s+/, '');

      // Extract due date
      const dueDateMatch = taskLine.match(/\s+-\s+Due\s+(.+?)$/);
      const title = dueDateMatch ? taskLine.replace(/\s+-\s+Due\s+.+$/, '') : taskLine;
      const dueDate = dueDateMatch ? parseDueDate(dueDateMatch[1]) : null;

      currentTask = {
        title: title.trim(),
        done,
        dueDate,
        notes: ''
      };
      collectingNotes = false;
      noteBuffer = [];
    }
    // Subtask (indented checkbox)
    else if (/^\s+[⬜✅]\s/.test(line) && currentTask) {
      collectingNotes = false;
      // Subtasks can be added to notes as well
      noteBuffer.push(line.trim());
    }
    // Notes marker
    else if (/^\s+Notes:\s*/.test(line) && currentTask) {
      collectingNotes = true;
      const notesContent = line.replace(/^\s+Notes:\s*/, '').trim();
      if (notesContent) {
        noteBuffer.push(notesContent);
      }
    }
    // Continuation (indented text)
    else if (/^\s+/.test(line) && currentTask) {
      collectingNotes = true;
      noteBuffer.push(trimmed);
    }
  }

  // Save last task
  if (currentTask) {
    currentTask.notes = noteBuffer.join('\n').trim();
    tasks.push(currentTask);
  }

  return tasks;
}

/**
 * Parse due date from various formats
 */
function parseDueDate(dateStr) {
  if (!dateStr) return null;

  // Remove zero-width characters and special spaces
  dateStr = dateStr.replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, ' ').trim();

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Handle "Today", "Yesterday", "Tomorrow"
  if (/today/i.test(dateStr)) {
    return today.toISOString();
  }

  if (/yesterday/i.test(dateStr)) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  }

  if (/tomorrow/i.test(dateStr)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  // Parse dates like "Thu, 6 Nov" or "Mon, 10 Nov" or "Sat, 10 Jan 2026"
  const dateMatch = dateStr.match(/(\d+)\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const monthStr = dateMatch[2];
    let year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();

    const monthMap = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const month = monthMap[monthStr];
    if (month !== undefined) {
      const parsed = new Date(year, month, day, 23, 59, 59, 999);

      // If date is in the past and no year specified, assume next year
      if (parsed < today && !dateMatch[3]) {
        parsed.setFullYear(today.getFullYear() + 1);
      }

      return parsed.toISOString();
    }
  }

  return null;
}

/**
 * Normalize title for matching
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find matching task by title
 */
function findMatchingTask(title, taskList) {
  const normalized = normalizeTitle(title);

  // Try exact match first
  let match = taskList.find(t => normalizeTitle(t.title) === normalized);
  if (match) return match;

  // Try partial match (contains)
  match = taskList.find(t => {
    const taskNorm = normalizeTitle(t.title);
    return taskNorm.includes(normalized) || normalized.includes(taskNorm);
  });
  if (match) return match;

  // Try word-by-word match
  const words = normalized.split(' ').filter(w => w.length > 3);
  if (words.length >= 2) {
    match = taskList.find(t => {
      const taskNorm = normalizeTitle(t.title);
      return words.every(word => taskNorm.includes(word));
    });
  }

  return match;
}

/**
 * Get all tasks from multiple projects
 */
async function getAllTasks() {
  const allTasks = [];
  const projectIds = [
    PROJECT_IDS.PARENT,
    PROJECT_IDS.CLEANING,
    PROJECT_IDS.MAINTENANCE,
    PROJECT_IDS.INVENTORY
  ];

  for (const projectId of projectIds) {
    const tasks = await vikunjaRequest(`/projects/${projectId}/tasks?per_page=500`);
    allTasks.push(...tasks.map(t => ({ ...t, currentProjectId: projectId })));
  }

  return allTasks;
}

/**
 * Update task
 */
async function updateTask(taskId, taskData) {
  return vikunjaRequest(`/tasks/${taskId}`, 'POST', taskData);
}

/**
 * Create task
 */
async function createTask(projectId, taskData) {
  return vikunjaRequest(`/projects/${projectId}/tasks`, 'PUT', taskData);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Vikunja task update and admin import...\n');

  try {
    // Step 1: Parse task files
    console.log('📄 Step 1: Parsing task files...');
    const staffTasksPath = path.join(__dirname, '..', 'todotasks', 'stafftasks.txt');
    const adminTasksPath = path.join(__dirname, '..', 'todotasks', 'admin tasks.txt');

    const staffTasks = parseMicrosoftTodoFile(staffTasksPath);
    const adminTasks = parseMicrosoftTodoFile(adminTasksPath);

    console.log(`✓ Parsed ${staffTasks.length} staff tasks`);
    console.log(`✓ Parsed ${adminTasks.length} admin tasks`);
    console.log('');

    // Step 2: Get all existing tasks
    console.log('📋 Step 2: Fetching all existing tasks...');
    const existingTasks = await getAllTasks();
    console.log(`✓ Found ${existingTasks.length} existing tasks`);
    console.log('');

    // Step 3: Update existing tasks with notes
    console.log('📝 Step 3: Updating existing tasks with notes from stafftasks.txt...');
    let updatedCount = 0;

    for (const staffTask of staffTasks) {
      const matchingTask = findMatchingTask(staffTask.title, existingTasks);

      if (matchingTask) {
        // Only update if there are notes and task doesn't already have description
        if (staffTask.notes && (!matchingTask.description || matchingTask.description.trim() === '')) {
          console.log(`  ✓ Updating: "${matchingTask.title}"`);
          console.log(`    Notes: ${staffTask.notes.substring(0, 60)}...`);

          await updateTask(matchingTask.id, {
            description: staffTask.notes
          });
          updatedCount++;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } else if (matchingTask.description && matchingTask.description.trim() !== '') {
          console.log(`  → Skipping: "${matchingTask.title}" (already has notes)`);
        }
      }
    }

    console.log(`\n✅ Updated ${updatedCount} tasks with notes`);
    console.log('');

    // Step 4: Import admin tasks
    console.log('📥 Step 4: Importing admin tasks to Admin project...');
    let importedCount = 0;
    let skippedCount = 0;

    for (const adminTask of adminTasks) {
      // Check if task already exists
      const existingMatch = findMatchingTask(adminTask.title, existingTasks);

      if (existingMatch) {
        console.log(`  → Skipping: "${adminTask.title}" (already exists)`);
        skippedCount++;
        continue;
      }

      const taskData = {
        title: adminTask.title,
        description: adminTask.notes || '',
        done: adminTask.done,
        due_date: adminTask.dueDate
      };

      console.log(`  ✓ Importing: "${adminTask.title}"`);
      if (adminTask.notes) {
        console.log(`    Notes: ${adminTask.notes.substring(0, 60)}...`);
      }
      if (adminTask.dueDate) {
        console.log(`    Due: ${adminTask.dueDate.split('T')[0]}`);
      }

      await createTask(PROJECT_IDS.ADMIN, taskData);
      importedCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ Imported ${importedCount} new admin tasks`);
    console.log(`⏭️  Skipped ${skippedCount} existing tasks`);
    console.log('');

    console.log('🎉 All done!');
    console.log('\n📊 Summary:');
    console.log(`  Staff task notes updated: ${updatedCount}`);
    console.log(`  Admin tasks imported: ${importedCount}`);
    console.log(`  Tasks skipped (duplicates): ${skippedCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Run the script
main().catch(console.error);
