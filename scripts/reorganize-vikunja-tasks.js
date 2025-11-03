/**
 * Reorganize Vikunja Tasks Script
 *
 * This script will:
 * 1. Create missing child projects (Admin, Inventory, Events & Marketing)
 * 2. Update existing tasks with notes from stafftasks.txt
 * 3. Import admin tasks with notes from admin tasks.txt
 * 4. Move tasks to appropriate child projects
 */

const fs = require('fs');
const path = require('path');

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

// Project IDs
const PROJECT_IDS = {
  PARENT: 2, // Sip n Play
  CLEANING: 3,
  MAINTENANCE: 4,
  ADMIN: null, // Will be created
  INVENTORY: null, // Will be created
  EVENTS: null // Will be created
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
  let currentSubtasks = [];
  let currentNotes = [];
  let inNotes = false;
  let isSubtask = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip title line and empty lines at start
    if (i === 0 || (!line.trim() && !currentTask)) continue;

    // Check for Completed section
    if (line.trim() === 'Completed') {
      if (currentTask) {
        currentTask.subtasks = currentSubtasks;
        currentTask.notes = currentNotes.join('\n').trim();
        tasks.push(currentTask);
      }
      break; // Stop processing at completed section
    }

    // Main task (starts with ⬜ or ✅ at column 0)
    if (/^[⬜✅]/.test(line)) {
      // Save previous task
      if (currentTask) {
        currentTask.subtasks = currentSubtasks;
        currentTask.notes = currentNotes.join('\n').trim();
        tasks.push(currentTask);
      }

      // Parse new task
      const done = line.startsWith('✅');
      const match = line.match(/^[⬜✅]\s+(.+?)(?:\s+-\s+Due\s+(.+?))?$/);

      if (match) {
        currentTask = {
          title: match[1].trim(),
          done,
          dueDate: parseDueDate(match[2]),
          subtasks: [],
          notes: ''
        };
        currentSubtasks = [];
        currentNotes = [];
        inNotes = false;
        isSubtask = false;
      }
    }
    // Subtask (indented with spaces/tabs)
    else if (/^\s+[⬜✅]/.test(line) && currentTask) {
      isSubtask = true;
      inNotes = false;
      const done = line.includes('✅');
      const match = line.match(/^\s+[⬜✅]\s+(.+?)(?:\s+-\s+Due\s+(.+?))?$/);

      if (match) {
        currentSubtasks.push({
          title: match[1].trim(),
          done,
          dueDate: parseDueDate(match[2])
        });
      }
    }
    // Notes section (indented, starts after "Notes:")
    else if (/^\s+Notes:/.test(line) && currentTask) {
      inNotes = true;
      isSubtask = false;
      const notesContent = line.replace(/^\s+Notes:\s*/, '');
      if (notesContent) {
        currentNotes.push(notesContent);
      }
    }
    // Continuation of notes or subtask notes
    else if (line.trim() && currentTask) {
      if (inNotes || /^\s+/.test(line)) {
        currentNotes.push(line.trim());
      }
    }
  }

  // Save last task
  if (currentTask) {
    currentTask.subtasks = currentSubtasks;
    currentTask.notes = currentNotes.join('\n').trim();
    tasks.push(currentTask);
  }

  return tasks;
}

/**
 * Parse due date from Microsoft To-Do format
 */
function parseDueDate(dateStr) {
  if (!dateStr) return null;

  // Handle "Today", "Yesterday", "Tomorrow"
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dateStr.includes('Today')) {
    return today.toISOString();
  }

  if (dateStr.includes('Yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  }

  if (dateStr.includes('Tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }

  // Parse relative dates like "Thu, 6 Nov", "Mon, 10 Nov", etc.
  // This is tricky without year context, assume current year or next year
  const dateMatch = dateStr.match(/(\d+)\s+([A-Za-z]+)(?:\s+(\d+))?/);
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
      const parsed = new Date(year, month, day);

      // If date is in the past, assume next year
      if (parsed < today && !dateMatch[3]) {
        parsed.setFullYear(today.getFullYear() + 1);
      }

      return parsed.toISOString();
    }
  }

  return null;
}

/**
 * Categorize task based on title and content
 */
function categorizeTask(task) {
  const title = task.title.toLowerCase();
  const notes = task.notes?.toLowerCase() || '';
  const combined = title + ' ' + notes;

  // Admin tasks (including handyman/repairs)
  if (
    combined.includes('rent payment') ||
    combined.includes('vendor') ||
    combined.includes('payment') ||
    combined.includes('salary') ||
    combined.includes('brainstorm kpi') ||
    combined.includes('immich') ||
    combined.includes('walkie talkie') ||
    combined.includes('fix') && (combined.includes('door') || combined.includes('wall') || combined.includes('sign') || combined.includes('table')) ||
    combined.includes('replace') && (combined.includes('fridge') || combined.includes('outdoor sign')) ||
    combined.includes('check float') ||
    combined.includes('blue box') || // Change management
    combined.includes('staff') && !combined.includes('clean')
  ) {
    return 'ADMIN';
  }

  // Maintenance (equipment, AC, consoles, technical)
  if (
    combined.includes('ac cleaning') ||
    combined.includes('ps4') ||
    combined.includes('ps5') ||
    combined.includes('fire alarm') ||
    combined.includes('gutter') && combined.includes('pipe') ||
    combined.includes('thermal paste') ||
    combined.includes('iknow') ||
    combined.includes('cleaning schedule') && (combined.includes('ps') || combined.includes('console'))
  ) {
    return 'MAINTENANCE';
  }

  // Cleaning tasks
  if (
    combined.includes('clean') ||
    combined.includes('wipe') ||
    combined.includes('sweep') ||
    combined.includes('bin spraying') ||
    combined.includes('deep clean') ||
    combined.includes('washing') ||
    combined.includes('arranging') && combined.includes('shelf')
  ) {
    return 'CLEANING';
  }

  // Inventory tasks
  if (
    combined.includes('stocktake') ||
    combined.includes('stock') ||
    combined.includes('restock') ||
    combined.includes('re-purchase') ||
    combined.includes('buy') ||
    combined.includes('purchase') ||
    combined.includes('order') ||
    combined.includes('check for out of date')
  ) {
    return 'INVENTORY';
  }

  // Events & Marketing
  if (
    combined.includes('menu') ||
    combined.includes('pos pricing') ||
    combined.includes('facebook') ||
    combined.includes('fb ') ||
    combined.includes('promotion') ||
    combined.includes('event') ||
    combined.includes('social media') ||
    combined.includes('kpi')
  ) {
    return 'EVENTS';
  }

  // Default: keep in parent project (one-off tasks)
  return 'PARENT';
}

/**
 * Create child project
 */
async function createChildProject(title, identifier, hexColor, description = '') {
  console.log(`Creating project: ${title}...`);

  const projectData = {
    title,
    identifier,
    hex_color: hexColor,
    parent_project_id: PROJECT_IDS.PARENT,
    description
  };

  const project = await vikunjaRequest('/projects', 'PUT', projectData);
  console.log(`✓ Created project: ${title} (ID: ${project.id})`);

  return project.id;
}

/**
 * Get all tasks from a project
 */
async function getProjectTasks(projectId) {
  return vikunjaRequest(`/projects/${projectId}/tasks?per_page=500`);
}

/**
 * Create task in project
 */
async function createTask(projectId, taskData) {
  return vikunjaRequest(`/projects/${projectId}/tasks`, 'PUT', taskData);
}

/**
 * Update task
 */
async function updateTask(taskId, taskData) {
  return vikunjaRequest(`/tasks/${taskId}`, 'POST', taskData);
}

/**
 * Move task to different project
 */
async function moveTask(taskId, newProjectId) {
  return updateTask(taskId, { project_id: newProjectId });
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Vikunja task reorganization...\n');

  try {
    // Step 1: Create missing child projects
    console.log('📁 Step 1: Creating child projects...');
    PROJECT_IDS.ADMIN = await createChildProject('Admin', 'Admin', '0080ff', 'Administrative tasks including rent, payments, staff management, and handyman work');
    PROJECT_IDS.INVENTORY = await createChildProject('Inventory', 'Inventory', '00ff00', 'Stock management, purchases, and inventory tracking');
    PROJECT_IDS.EVENTS = await createChildProject('Events & Marketing', 'Events', 'ff00ff', 'Menu updates, promotions, social media, and KPI tracking');
    console.log('');

    // Step 2: Parse task files
    console.log('📄 Step 2: Parsing task files...');
    const staffTasksPath = path.join(__dirname, '..', 'todotasks', 'stafftasks.txt');
    const adminTasksPath = path.join(__dirname, '..', 'todotasks', 'admin tasks.txt');

    const staffTasks = parseMicrosoftTodoFile(staffTasksPath);
    const adminTasks = parseMicrosoftTodoFile(adminTasksPath);

    console.log(`✓ Parsed ${staffTasks.length} staff tasks`);
    console.log(`✓ Parsed ${adminTasks.length} admin tasks`);
    console.log('');

    // Step 3: Get existing tasks from parent project
    console.log('📋 Step 3: Fetching existing tasks from Sip n Play project...');
    const existingTasks = await getProjectTasks(PROJECT_IDS.PARENT);
    console.log(`✓ Found ${existingTasks.length} existing tasks`);
    console.log('');

    // Step 4: Update existing tasks with notes from stafftasks.txt
    console.log('📝 Step 4: Updating existing tasks with notes...');
    let updatedCount = 0;

    for (const existingTask of existingTasks) {
      // Find matching task in staffTasks by title
      const matchingStaffTask = staffTasks.find(st =>
        st.title.toLowerCase() === existingTask.title.toLowerCase() ||
        existingTask.title.toLowerCase().includes(st.title.toLowerCase()) ||
        st.title.toLowerCase().includes(existingTask.title.toLowerCase())
      );

      if (matchingStaffTask && matchingStaffTask.notes) {
        console.log(`  Updating: "${existingTask.title}"`);
        await updateTask(existingTask.id, {
          description: matchingStaffTask.notes
        });
        updatedCount++;
      }
    }
    console.log(`✓ Updated ${updatedCount} tasks with notes`);
    console.log('');

    // Step 5: Import admin tasks
    console.log('📥 Step 5: Importing admin tasks...');
    let importedCount = 0;

    for (const adminTask of adminTasks) {
      const taskData = {
        title: adminTask.title,
        description: adminTask.notes,
        done: adminTask.done,
        due_date: adminTask.dueDate,
        project_id: PROJECT_IDS.ADMIN
      };

      console.log(`  Importing: "${adminTask.title}"`);
      const createdTask = await createTask(PROJECT_IDS.ADMIN, taskData);

      // Create subtasks if any
      if (adminTask.subtasks && adminTask.subtasks.length > 0) {
        for (const subtask of adminTask.subtasks) {
          await vikunjaRequest(`/tasks/${createdTask.id}/relations`, 'PUT', {
            other_task_id: 0, // This creates a subtask
            relation_kind: 'subtask',
            task: {
              title: subtask.title,
              done: subtask.done,
              due_date: subtask.dueDate
            }
          });
        }
      }

      importedCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`✓ Imported ${importedCount} admin tasks`);
    console.log('');

    // Step 6: Reorganize existing tasks into categories
    console.log('🗂️  Step 6: Reorganizing tasks into categories...');
    const refreshedTasks = await getProjectTasks(PROJECT_IDS.PARENT);

    const categoryCounts = {
      ADMIN: 0,
      CLEANING: 0,
      MAINTENANCE: 0,
      INVENTORY: 0,
      EVENTS: 0,
      PARENT: 0
    };

    for (const task of refreshedTasks) {
      const category = categorizeTask(task);

      if (category !== 'PARENT' && PROJECT_IDS[category]) {
        console.log(`  Moving to ${category}: "${task.title}"`);
        await moveTask(task.id, PROJECT_IDS[category]);
        categoryCounts[category]++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        categoryCounts.PARENT++;
      }
    }

    console.log('\n📊 Reorganization Summary:');
    console.log(`  Admin: ${categoryCounts.ADMIN} tasks`);
    console.log(`  Cleaning: ${categoryCounts.CLEANING} tasks`);
    console.log(`  Maintenance: ${categoryCounts.MAINTENANCE} tasks`);
    console.log(`  Inventory: ${categoryCounts.INVENTORY} tasks`);
    console.log(`  Events & Marketing: ${categoryCounts.EVENTS} tasks`);
    console.log(`  Remaining in Parent (one-off): ${categoryCounts.PARENT} tasks`);
    console.log('');

    console.log('✅ Reorganization complete!');
    console.log('\n📁 Project Structure:');
    console.log('  Sip n Play (Parent)');
    console.log('    ├── Admin');
    console.log('    ├── Cleaning');
    console.log('    ├── Maintenance');
    console.log('    ├── Inventory');
    console.log('    └── Events & Marketing');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Run the script
main().catch(console.error);
