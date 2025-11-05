/**
 * Reformat Vikunja Task Descriptions
 *
 * Cleans up and reformats all task descriptions in Board Game Issues project:
 * - Removes HTML tags and markdown formatting
 * - Fixes capitalization and typos
 * - Shortens date format (November 2, 2025 → Nov 2 2025)
 * - Removes boilerplate text
 * - Adds "note" label to all missing piece tasks
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const BOARD_GAME_ISSUES_PROJECT_ID = 25;
const NOTE_LABEL_ID = 26; // "note" label for non-actionable observations

// Month name mapping for date formatting
const MONTHS = {
  'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
  'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
  'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
};

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Format date from "Month Day, Year" to "Mon Day Year"
 */
function formatDate(dateStr) {
  for (const [full, short] of Object.entries(MONTHS)) {
    const regex = new RegExp(`\\b${full}\\b`, 'g');
    dateStr = dateStr.replace(regex, short);
  }
  return dateStr.replace(/,/g, ''); // Remove commas
}

/**
 * Fix common capitalization issues and typos
 */
function fixCapitalization(text) {
  // Fix "i" at start of sentence or after punctuation
  text = text.replace(/(^|\.\s+|!\s+|\?\s+)i\s+/gi, '$1I ');

  // Fix "i" as standalone word
  text = text.replace(/\bi\s+/g, 'I ');

  // Common typo fixes
  text = text.replace(/\bputple\b/gi, 'Purple');
  text = text.replace(/\bkios\b/gi, 'Kiosk');
  text = text.replace(/\b(\d+)coin\b/gi, '$1 coin');

  // Capitalize first letter if lowercase
  if (text.length > 0 && text[0] === text[0].toLowerCase()) {
    text = text[0].toUpperCase() + text.slice(1);
  }

  return text;
}

/**
 * Parse and reformat task description
 */
function reformatDescription(description) {
  // Strip HTML tags first
  let clean = stripHtml(description);

  // Remove markdown formatting
  clean = clean.replace(/\*\*/g, '');

  // Extract components
  const issueMatch = clean.match(/(?:Issue|Note):\s*(.+?)(?:\s+Reported by|$)/s);
  const reporterMatch = clean.match(/Reported by:\s*(.+?)(?:\s+Original Check Date|Game ID|$)/s);
  const dateMatch = clean.match(/Original Check Date:\s*(.+?)(?:\s+Game ID|$)/s);

  // Extract cleaned values
  let issue = issueMatch ? issueMatch[1].trim() : '';
  let reporter = reporterMatch ? reporterMatch[1].trim() : 'Unknown';
  let date = dateMatch ? dateMatch[1].trim() : '';

  // Remove trailing punctuation like " ." or " ,"
  issue = issue.replace(/\s+[.,]\s*$/, '');

  // Fix capitalization and typos
  issue = fixCapitalization(issue);

  // Format date
  if (date) {
    date = formatDate(date);
  }

  // Build reformatted description
  if (issue && date) {
    return `${issue}. Reported by ${reporter} on ${date}.`;
  } else if (issue) {
    return `${issue}. Reported by ${reporter}.`;
  } else {
    // Fallback if parsing failed - just clean up the original
    clean = clean.replace(/\(Backlog item.*?\)/g, '');
    clean = clean.replace(/This issue was found.*?attention\./g, '');
    clean = clean.replace(/This is a non-actionable observation.*$/g, '');
    clean = clean.replace(/Complete this task.*?points!/g, '');
    clean = clean.trim();
    return clean;
  }
}

/**
 * Check if task already has "note" label
 */
async function hasNoteLabel(taskId) {
  const result = await pool.query(`
    SELECT 1 FROM label_tasks
    WHERE task_id = $1 AND label_id = $2
  `, [taskId, NOTE_LABEL_ID]);
  return result.rows.length > 0;
}

/**
 * Add "note" label to task
 */
async function addNoteLabel(taskId) {
  await pool.query(`
    INSERT INTO label_tasks (task_id, label_id, created)
    VALUES ($1, $2, NOW())
    ON CONFLICT DO NOTHING
  `, [taskId, NOTE_LABEL_ID]);
}

async function main() {
  console.log('🔧 Reformatting task descriptions in Board Game Issues project...\n');

  try {
    // Fetch all undone tasks from Board Game Issues project
    const tasks = await pool.query(`
      SELECT id, title, description, done
      FROM tasks
      WHERE project_id = $1
        AND done = false
      ORDER BY id
    `, [BOARD_GAME_ISSUES_PROJECT_ID]);

    console.log(`📋 Found ${tasks.rows.length} undone tasks to process\n`);

    if (tasks.rows.length === 0) {
      console.log('✨ No tasks to reformat.');
      return;
    }

    let reformatted = 0;
    let labeled = 0;
    let errors = 0;

    for (const task of tasks.rows) {
      try {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Task #${task.id}: ${task.title}`);

        // Reformat description
        const oldDescription = task.description;
        const newDescription = reformatDescription(oldDescription);

        console.log(`\n📝 Old:\n${oldDescription.substring(0, 200)}...\n`);
        console.log(`✨ New:\n${newDescription}\n`);

        // Update description in database
        await pool.query(`
          UPDATE tasks
          SET description = $1, updated = NOW()
          WHERE id = $2
        `, [newDescription, task.id]);

        reformatted++;
        console.log(`✅ Description updated`);

        // Add "note" label if task is about missing pieces
        if (task.title.toLowerCase().includes('missing pieces')) {
          const hasLabel = await hasNoteLabel(task.id);
          if (!hasLabel) {
            await addNoteLabel(task.id);
            labeled++;
            console.log(`🏷️  Added "note" label`);
          } else {
            console.log(`🏷️  Already has "note" label`);
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Error processing task #${task.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:');
    console.log(`   ✅ Descriptions reformatted: ${reformatted}`);
    console.log(`   🏷️  "note" labels added: ${labeled}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✨ Reformatting complete!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
