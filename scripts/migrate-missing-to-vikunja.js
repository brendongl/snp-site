/**
 * Migrate missing items from content checks to Vikunja
 * Run: node scripts/migrate-missing-to-vikunja.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import fetch from 'node-fetch';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

const VIKUNJA_API_URL = process.env.VIKUNJA_API_URL || 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_API_TOKEN = process.env.VIKUNJA_API_TOKEN;

if (!VIKUNJA_API_TOKEN) {
  console.error('Error: VIKUNJA_API_TOKEN not set in environment');
  process.exit(1);
}

async function createVikunjaTask(taskData) {
  const response = await fetch(`${VIKUNJA_API_URL}/projects/1/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VIKUNJA_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Vikunja task: ${error}`);
  }

  return response.json();
}

async function migrateMissingToVikunja() {
  try {
    console.log('Migrating missing items to Vikunja...\n');

    // Load report
    const reportPath = 'scripts/missing-items-report.json';
    if (!fs.existsSync(reportPath)) {
      console.error('Error: Run analyze-missing-items.js first to generate report');
      await pool.end();
      process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    console.log(`Found ${report.total_games} games with missing items\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const game of report.games) {
      try {
        const mostRecent = game.most_recent_check;

        // Extract what's missing from notes
        const notesLower = mostRecent.notes.toLowerCase();
        let whatsMissing = mostRecent.notes;

        // Try to extract just the missing part
        if (notesLower.includes('missing:')) {
          whatsMissing = mostRecent.notes
            .substring(notesLower.indexOf('missing:') + 8)
            .trim();
        }

        // Clean up duplicate "missing" text
        whatsMissing = whatsMissing.replace(/^missing\s*/i, '');

        // Check if task already exists for this game
        const existingTasks = await fetch(
          `${VIKUNJA_API_URL}/projects/1/tasks?filter=description~${game.game_id}`,
          {
            headers: {
              'Authorization': `Bearer ${VIKUNJA_API_TOKEN}`,
            },
          }
        ).then((r) => r.json());

        const alreadyExists = Array.isArray(existingTasks) && existingTasks.some((t) =>
          t.title.toLowerCase().includes('missing pieces') &&
          t.description.includes(game.game_id)
        );

        if (alreadyExists) {
          console.log(`⊘ Skipping ${game.game_name} - Task already exists`);
          skipped++;
          continue;
        }

        // Create Vikunja task
        const taskData = {
          title: `Missing Pieces - ${game.game_name || 'Unknown Game'}`,
          description: `**Issue:** ${whatsMissing}\n**Reported on:** ${mostRecent.checked_date}\n**Reported by:** ${mostRecent.inspector || 'Unknown'}\n**Game ID:** ${game.game_id}\n**Complexity:** 2\n\nComplete this task to resolve the issue and earn 500 points!`,
          project_id: 1, // Observation Notes
          priority: 2,
          labels: [{ id: 5 }], // Assuming label ID 5 is "points:500"
        };

        const createdTask = await createVikunjaTask(taskData);
        console.log(`✓ Created task for ${game.game_name} (Task ID: ${createdTask.id})`);
        created++;

        // Rate limiting - wait 1 second between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`✗ Error creating task for ${game.game_name}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`✓ Created: ${created} tasks`);
    console.log(`⊘ Skipped: ${skipped} tasks (already exist)`);
    console.log(`✗ Errors: ${errors} tasks`);

    await pool.end();
  } catch (error) {
    console.error('Error migrating missing items:', error);
    await pool.end();
    throw error;
  }
}

migrateMissingToVikunja()
  .then(() => {
    console.log('\n✓ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
