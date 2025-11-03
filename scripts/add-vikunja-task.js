#!/usr/bin/env node
/**
 * Add Vikunja Task via CLI
 *
 * Workaround for Vikunja UI bug where "+ ADD" button doesn't work
 *
 * Usage:
 *   node scripts/add-vikunja-task.js
 *   node scripts/add-vikunja-task.js --title "Task name" --project 2
 */

const readline = require('readline');

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const API_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

const PROJECTS = {
  1: 'Inbox',
  2: 'Sip n Play',
  3: 'Cleaning',
  4: 'Maintenance',
  6: 'test',
  7: 'Admin',
  8: 'Inventory',
  9: 'Events & Marketing'
};

const POINT_LABELS = [
  { id: 1, title: 'points:100', description: 'Simple quick task (5-15 min)' },
  { id: 2, title: 'points:200', description: 'Minor task (15-30 min)' },
  { id: 3, title: 'points:500', description: 'Standard task (30-60 min)' },
  { id: 4, title: 'points:1000', description: 'Medium effort task (1-2 hours)' },
  { id: 5, title: 'points:5000', description: 'Major task (half day)' },
  { id: 6, title: 'points:10000', description: 'Large project (full day)' },
  { id: 7, title: 'points:20000', description: 'Major project (2-3 days)' },
  { id: 8, title: 'points:50000', description: 'Epic achievement (1+ week)' }
];

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function createTask(taskData) {
  const response = await fetch(`${VIKUNJA_URL}/projects/${taskData.project_id}/tasks`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create task: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function addLabels(taskId, labelIds) {
  for (const labelId of labelIds) {
    const response = await fetch(`${VIKUNJA_URL}/tasks/${taskId}/labels`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ label_id: labelId })
    });

    if (!response.ok) {
      console.warn(`Warning: Could not add label ${labelId}`);
    }
  }
}

async function main() {
  console.log('🎯 Vikunja Task Creator (CLI Workaround)');
  console.log('=' .repeat(50));
  console.log('');

  // Check for command line args
  const args = process.argv.slice(2);
  let title, projectId, description, dueDate, points;

  if (args.includes('--title')) {
    const titleIndex = args.indexOf('--title');
    title = args[titleIndex + 1];
  }

  if (args.includes('--project')) {
    const projectIndex = args.indexOf('--project');
    projectId = parseInt(args[projectIndex + 1]);
  }

  // Interactive prompts
  if (!title) {
    title = await prompt('📝 Task title: ');
  }

  if (!projectId) {
    console.log('\n📁 Available projects:');
    Object.entries(PROJECTS).forEach(([id, name]) => {
      console.log(`   ${id}. ${name}`);
    });
    const projectInput = await prompt('\nProject ID [2 for Sip n Play]: ') || '2';
    projectId = parseInt(projectInput);
  }

  description = await prompt('📄 Description (optional): ');

  const dueDateInput = await prompt('📅 Due date (YYYY-MM-DD, optional): ');
  if (dueDateInput) {
    dueDate = new Date(dueDateInput).toISOString();
  }

  const addPoints = await prompt('\n💎 Add points? (y/n) [n]: ');
  if (addPoints.toLowerCase() === 'y') {
    console.log('\nAvailable point values:');
    POINT_LABELS.forEach((label, index) => {
      console.log(`   ${index + 1}. ${label.title} - ${label.description}`);
    });
    const pointChoice = await prompt('Select points (1-8): ');
    if (pointChoice && pointChoice >= 1 && pointChoice <= 8) {
      points = POINT_LABELS[parseInt(pointChoice) - 1].id;
    }
  }

  // Create task
  console.log('\n🚀 Creating task...');

  const taskData = {
    title,
    done: false
  };

  if (description) taskData.description = description;
  if (dueDate) taskData.due_date = dueDate;

  try {
    const task = await createTask({ ...taskData, project_id: projectId });
    console.log('✅ Task created successfully!');
    console.log(`   Task ID: ${task.id}`);
    console.log(`   Identifier: ${task.identifier}`);
    console.log(`   Title: ${task.title}`);

    // Add points label if selected
    if (points) {
      console.log('\n💎 Adding point label...');
      await addLabels(task.id, [points]);
      const pointLabel = POINT_LABELS[points - 1];
      console.log(`✅ Added ${pointLabel.title}`);
    }

    console.log('\n✨ Done! Task will appear in Vikunja and on your dashboard.');
    console.log(`   View at: https://tasks.sipnplay.cafe/projects/${projectId}#task-${task.id}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
