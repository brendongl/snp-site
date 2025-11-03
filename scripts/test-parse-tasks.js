/**
 * Test parser for Microsoft To-Do format
 */

const fs = require('fs');
const path = require('path');

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
      const taskLine = line.replace(/^[⬜✅]\s+/, '');
      const dueDateMatch = taskLine.match(/\s+-\s+Due\s+(.+)$/);
      const title = dueDateMatch ? taskLine.replace(/\s+-\s+Due\s+.+$/, '') : taskLine;
      const dueDate = dueDateMatch ? dueDateMatch[1] : null;

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

// Test parsing
const staffTasksPath = path.join(__dirname, '..', 'todotasks', 'stafftasks.txt');
const adminTasksPath = path.join(__dirname, '..', 'todotasks', 'admin tasks.txt');

console.log('Testing stafftasks.txt parser...');
console.log('File exists:', fs.existsSync(staffTasksPath));

if (fs.existsSync(staffTasksPath)) {
  const staffTasks = parseMicrosoftTodoFile(staffTasksPath);
  console.log(`Parsed ${staffTasks.length} staff tasks\n`);

  // Show first 5 tasks
  staffTasks.slice(0, 5).forEach((task, i) => {
    console.log(`Task ${i + 1}:`);
    console.log(`  Title: ${task.title}`);
    console.log(`  Done: ${task.done}`);
    console.log(`  Due: ${task.dueDate || 'None'}`);
    console.log(`  Notes: ${task.notes ? task.notes.substring(0, 100) + '...' : 'None'}`);
    console.log('');
  });
}

console.log('\nTesting admin tasks.txt parser...');
console.log('File exists:', fs.existsSync(adminTasksPath));

if (fs.existsSync(adminTasksPath)) {
  const adminTasks = parseMicrosoftTodoFile(adminTasksPath);
  console.log(`Parsed ${adminTasks.length} admin tasks\n`);

  // Show first 5 tasks
  adminTasks.slice(0, 5).forEach((task, i) => {
    console.log(`Task ${i + 1}:`);
    console.log(`  Title: ${task.title}`);
    console.log(`  Done: ${task.done}`);
    console.log(`  Due: ${task.dueDate || 'None'}`);
    console.log(`  Notes: ${task.notes ? task.notes.substring(0, 100) + '...' : 'None'}`);
    console.log('');
  });
}
