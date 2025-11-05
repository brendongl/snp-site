/**
 * Preview Task Descriptions
 *
 * Shows full descriptions of tasks to understand format before reformatting
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function previewTasks() {
  console.log('📋 Fetching task descriptions from Board Game Issues...\n');

  try {
    // Get all undone tasks from Board Game Issues project
    const tasks = await pool.query(`
      SELECT id, title, description, done
      FROM tasks
      WHERE project_id = 25
        AND done = false
      ORDER BY id
      LIMIT 10
    `);

    console.log(`Found ${tasks.rows.length} undone tasks\n`);

    tasks.rows.forEach((task, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Task #${task.id}: ${task.title}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Description:\n${task.description}\n`);
    });

    // Check if any have the "note" label
    const labeledTasks = await pool.query(`
      SELECT t.id, t.title, l.title as label_title
      FROM tasks t
      JOIN label_tasks lt ON t.id = lt.task_id
      JOIN labels l ON lt.label_id = l.id
      WHERE t.project_id = 25
        AND t.done = false
        AND l.id = 26
    `);

    console.log(`\n🏷️  Tasks already labeled as "note": ${labeledTasks.rows.length}`);
    labeledTasks.rows.forEach(task => {
      console.log(`  - Task #${task.id}: ${task.title}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

previewTasks();
