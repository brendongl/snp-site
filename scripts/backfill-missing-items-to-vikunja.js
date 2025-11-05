/**
 * Backfill Vikunja Tasks from Content Checks with Missing Items
 *
 * This script:
 * 1. Queries all content_checks with "missing" in notes
 * 2. Creates Vikunja tasks in "Board Game Issues" project (ID 25)
 * 3. Formats tasks like issue reports with backlog date in description
 *
 * Run: node scripts/backfill-missing-items-to-vikunja.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const VIKUNJA_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = process.env.VIKUNJA_API_TOKEN;
const BOARD_GAME_ISSUES_PROJECT_ID = 25; // Board Game Issues project
const MISSING_PIECES_LABEL_ID = 137; // "missing_pieces" label (you may need to adjust this)

async function main() {
  console.log('🔍 Searching for content checks with missing items...\n');

  if (!VIKUNJA_TOKEN) {
    console.error('❌ VIKUNJA_API_TOKEN not set in environment');
    process.exit(1);
  }

  try {
    // Query content checks with "missing" in notes
    const result = await pool.query(`
      SELECT
        cc.id as check_id,
        cc.check_date,
        cc.notes,
        cc.inspector_id,
        g.id as game_id,
        g.name as game_name,
        g.complexity,
        s.staff_name as inspector_name,
        s.nickname as inspector_nickname
      FROM content_checks cc
      JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list s ON cc.inspector_id = s.id
      WHERE LOWER(cc.notes) LIKE '%missing%'
        AND cc.notes IS NOT NULL
        AND cc.notes != ''
      ORDER BY cc.check_date DESC
    `);

    console.log(`✅ Found ${result.rows.length} content checks with "missing" in notes\n`);

    if (result.rows.length === 0) {
      console.log('✨ No missing items found. Exiting.');
      await pool.end();
      return;
    }

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Process each content check
    for (const check of result.rows) {
      try {
        const inspectorName = check.inspector_nickname || check.inspector_name || 'Unknown';
        const checkDate = new Date(check.check_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Extract just the missing part from notes
        const missingMatch = check.notes.match(/missing[^.]*\.?/gi);
        const missingDescription = missingMatch ? missingMatch[0] : check.notes;

        // Create Vikunja task
        const taskTitle = `Missing Pieces - ${check.game_name}`;
        const taskDescription = `**Issue:** ${missingDescription}

**Reported by:** ${inspectorName}
**Original Check Date:** ${checkDate}
**Game ID:** ${check.game_id}
**Complexity:** ${check.complexity}

_(Backlog item - imported from historical content check)_

This issue was found during a content check and needs attention.`;

        // Check if task already exists for this game (avoid duplicates)
        const existingTasksResponse = await fetch(
          `${VIKUNJA_URL}/projects/${BOARD_GAME_ISSUES_PROJECT_ID}/tasks?filter=title like %${encodeURIComponent(check.game_name)}%`,
          {
            headers: {
              'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (existingTasksResponse.ok) {
          const existingTasks = await existingTasksResponse.json();
          const hasDuplicate = existingTasks.some(
            task => task.title.includes(check.game_name) && task.title.includes('Missing Pieces')
          );

          if (hasDuplicate) {
            console.log(`⏭️  Skipping ${check.game_name} - Task already exists`);
            skipped++;
            continue;
          }
        }

        // Create the task (without labels - they can be added manually later)
        const createResponse = await fetch(
          `${VIKUNJA_URL}/projects/${BOARD_GAME_ISSUES_PROJECT_ID}/tasks`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: taskTitle,
              description: taskDescription,
              project_id: BOARD_GAME_ISSUES_PROJECT_ID,
              priority: 2, // Medium priority
              done: false
            })
          }
        );

        if (!createResponse.ok) {
          const error = await createResponse.text();
          console.error(`❌ Failed to create task for ${check.game_name}: ${error}`);
          errors++;
          continue;
        }

        const createdTask = await createResponse.json();
        console.log(`✅ Created task #${createdTask.id}: ${taskTitle}`);
        created++;

        // Rate limiting: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error processing ${check.game_name}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${created} tasks`);
    console.log(`   ⏭️  Skipped: ${skipped} (duplicates)`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Backfill complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
