/**
 * Compare PostgreSQL database count vs Vikunja API response
 */

const { Pool } = require('pg');

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const PROJECT_ID = 25;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkPostgreSQL() {
  console.log('🗄️  Checking PostgreSQL database...\n');

  const query = `
    SELECT
      t.id,
      t.title,
      t.done
    FROM tasks t
    WHERE t.project_id = 25
      AND t.id IN (
        SELECT task_id
        FROM label_tasks
        WHERE label_id = 26
      )
    ORDER BY t.id DESC;
  `;

  const result = await pool.query(query);
  const allTasks = result.rows;
  const activeTasks = allTasks.filter(task => !task.done);

  console.log(`✅ PostgreSQL: ${activeTasks.length} active note tasks (${allTasks.length} total)\n`);

  return activeTasks;
}

async function checkVikunjaAPI() {
  console.log('🌐 Checking Vikunja API response...\n');

  const response = await fetch(`${VIKUNJA_URL}/projects/${PROJECT_ID}/tasks?per_page=500&sort_by=id&order_by=desc`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  const allTasks = await response.json();

  // Filter note tasks
  const noteTasks = allTasks.filter(task => {
    const hasNoteLabel = task.labels?.some(label => label.id === 26 || label.title === 'note');
    return hasNoteLabel && !task.done;
  });

  console.log(`✅ Vikunja API: ${noteTasks.length} active note tasks (${allTasks.length} total tasks fetched)\n`);

  return noteTasks;
}

async function main() {
  try {
    const pgTasks = await checkPostgreSQL();
    await pool.end();

    const apiTasks = await checkVikunjaAPI();

    console.log('📊 COMPARISON:');
    console.log(`   PostgreSQL: ${pgTasks.length} active note tasks`);
    console.log(`   Vikunja API: ${apiTasks.length} active note tasks`);
    console.log(`   Discrepancy: ${pgTasks.length - apiTasks.length} tasks missing from API\n`);

    if (pgTasks.length !== apiTasks.length) {
      console.log('⚠️  DISCREPANCY DETECTED!\n');

      // Find which tasks are in DB but not in API
      const apiTaskIds = new Set(apiTasks.map(t => t.id));
      const missingFromAPI = pgTasks.filter(t => !apiTaskIds.has(t.id));

      console.log(`❌ Tasks in database but NOT in API response (${missingFromAPI.length}):`);
      missingFromAPI.forEach((task, i) => {
        console.log(`   ${i + 1}. Task ${task.id}: "${task.title}"`);
      });

      // Find which tasks are in API but not in DB
      const pgTaskIds = new Set(pgTasks.map(t => t.id));
      const extraInAPI = apiTasks.filter(t => !pgTaskIds.has(t.id));

      if (extraInAPI.length > 0) {
        console.log(`\n➕ Tasks in API but NOT in database (${extraInAPI.length}):`);
        extraInAPI.forEach((task, i) => {
          console.log(`   ${i + 1}. Task ${task.id}: "${task.title}"`);
        });
      }
    } else {
      console.log('✅ Counts match! No discrepancy.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
