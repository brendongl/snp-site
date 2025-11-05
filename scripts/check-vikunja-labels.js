/**
 * Check Vikunja Labels and Sample Tasks
 *
 * Explores existing labels and sample tasks to prepare for reformatting
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkLabels() {
  console.log('🏷️  Checking existing labels...\n');

  try {
    // Get all labels
    const labels = await pool.query('SELECT id, title, description, hex_color FROM labels ORDER BY id');
    console.log('All labels:');
    labels.rows.forEach(label => {
      console.log(`  [${label.id}] ${label.title} - ${label.description || 'no description'}`);
    });

    // Check if 'note' label exists
    const noteLabel = labels.rows.find(l => l.title.toLowerCase() === 'note');
    if (noteLabel) {
      console.log(`\n✅ 'note' label exists: ID ${noteLabel.id}`);
    } else {
      console.log(`\n❌ 'note' label does not exist - will need to create it`);
    }

    // Get sample tasks from Board Game Issues project
    console.log('\n📋 Sample tasks from Board Game Issues (project_id=25):');
    const tasks = await pool.query(`
      SELECT id, title, LEFT(description, 150) as description_preview, done
      FROM tasks
      WHERE project_id = 25
      ORDER BY id
      LIMIT 5
    `);

    tasks.rows.forEach(task => {
      console.log(`\n  Task #${task.id}: ${task.title}`);
      console.log(`    Done: ${task.done}`);
      console.log(`    Description: ${task.description_preview}...`);
    });

    // Check label_tasks table to understand relationship
    console.log('\n🔗 Checking label_tasks relationship table:');
    const labelTasks = await pool.query('SELECT * FROM label_tasks LIMIT 3');
    console.log('Sample label_tasks entries:', labelTasks.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkLabels();
