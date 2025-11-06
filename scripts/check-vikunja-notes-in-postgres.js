/**
 * Query PostgreSQL database directly to count Vikunja tasks with "note" label
 * This bypasses the Vikunja API to see the raw database count
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkVikunjaNotesInDatabase() {
  console.log('🔍 Checking Vikunja tasks directly in PostgreSQL database...\n');

  try {
    // Query to find all tasks with "note" label (label_id = 26) in project 25
    const query = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.done,
        t.created,
        array_agg(l.title) as labels
      FROM tasks t
      LEFT JOIN label_tasks lt ON t.id = lt.task_id
      LEFT JOIN labels l ON lt.label_id = l.id
      WHERE t.project_id = 25
        AND t.id IN (
          SELECT task_id
          FROM label_tasks
          WHERE label_id = 26
        )
      GROUP BY t.id, t.title, t.description, t.done, t.created
      ORDER BY t.id DESC;
    `;

    const result = await pool.query(query);
    const allNoteTasks = result.rows;

    // Filter to only not-done tasks
    const activeNoteTasks = allNoteTasks.filter(task => !task.done);

    console.log(`📊 Database Results:`);
    console.log(`   Total tasks with "note" label: ${allNoteTasks.length}`);
    console.log(`   Active (not done) tasks: ${activeNoteTasks.length}`);
    console.log(`   Completed (done) tasks: ${allNoteTasks.length - activeNoteTasks.length}`);

    console.log(`\n📋 Active note tasks (newest to oldest):`);
    activeNoteTasks.forEach((task, i) => {
      console.log(`   ${i + 1}. Task ${task.id}: "${task.title}"`);
    });

    console.log(`\n✅ Completed note tasks:`);
    allNoteTasks.filter(task => task.done).forEach((task, i) => {
      console.log(`   ${i + 1}. Task ${task.id}: "${task.title}" (DONE)`);
    });

    return activeNoteTasks;

  } catch (error) {
    console.error('❌ Database query error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkVikunjaNotesInDatabase().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
