# Phase 9: Content Checks Data Cleanup & Migration

**Priority**: 🟢 Low
**Effort**: Large (1.5-2 hours)
**Dependencies**: None (can run in parallel with testing)
**Affects**: Vikunja task creation, content checks data

---

## Issue Addressed

### Issue #14: Migrate Missing Items to Vikunja

Analyze all content checks for games with "missing" items in notes and create Vikunja tasks for them.

**Example notes:**
- "Missing 2 number 1 coins and 1 number 5 coin"
- "missing 1 red meeple"
- "Missing: Missing 2 number 1 coins and 1 number 5 coin" (duplicate)

**Requirements:**
- Create Vikunja task in "Observation Notes" project (ID: 1)
- Include reported date in description
- Include reporter if available
- Add game ID to description
- Use "Missing Pieces" issue type
- Tasks should appear in staff dashboard

---

## Implementation Strategy

### Step 1: Analyze Content Checks

Create a script to scan all content checks for "missing" keywords.

**File**: [scripts/analyze-missing-items.js](../../scripts/analyze-missing-items.js) (new)

```javascript
/**
 * Analyze content checks for missing items
 * Run: node scripts/analyze-missing-items.js
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function analyzeMissingItems() {
  try {
    console.log('Analyzing content checks for missing items...\n');

    // Query all content checks with "missing" in notes (case-insensitive)
    const result = await sql`
      SELECT
        cc.id,
        cc.game_record_id,
        cc.checked_date,
        cc.status,
        cc.notes,
        cc.inspector,
        g.name as game_name,
        g.bgg_id
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_record_id = g.id
      WHERE LOWER(cc.notes) LIKE '%missing%'
      ORDER BY cc.checked_date DESC;
    `;

    console.log(`Found ${result.rowCount} content checks with 'missing' in notes\n`);

    if (result.rowCount === 0) {
      console.log('No missing items found.');
      return;
    }

    // Group by game
    const byGame = new Map();

    result.rows.forEach((check) => {
      if (!byGame.has(check.game_record_id)) {
        byGame.set(check.game_record_id, {
          game_id: check.game_record_id,
          game_name: check.game_name,
          checks: [],
        });
      }
      byGame.get(check.game_record_id).checks.push(check);
    });

    // Generate report
    const report = {
      total_checks: result.rowCount,
      total_games: byGame.size,
      games: Array.from(byGame.values()).map((game) => ({
        ...game,
        most_recent_check: game.checks[0],
        total_checks_with_missing: game.checks.length,
      })),
    };

    // Save report
    const reportPath = 'scripts/missing-items-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`✓ Report saved to ${reportPath}`);

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total games with missing items: ${report.total_games}`);
    console.log(`Total content checks mentioning missing: ${report.total_checks}\n`);

    console.log('=== Games with Missing Items ===');
    report.games.forEach((game, index) => {
      console.log(`\n${index + 1}. ${game.game_name || 'Unknown Game'} (${game.game_id})`);
      console.log(`   Checks with missing: ${game.total_checks_with_missing}`);
      console.log(`   Most recent: ${game.most_recent_check.checked_date}`);
      console.log(`   Notes: ${game.most_recent_check.notes.substring(0, 100)}...`);
    });

    return report;
  } catch (error) {
    console.error('Error analyzing missing items:', error);
    throw error;
  }
}

analyzeMissingItems()
  .then(() => {
    console.log('\n✓ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Analysis failed:', error);
    process.exit(1);
  });
```

### Step 2: Create Vikunja Tasks Script

**File**: [scripts/migrate-missing-to-vikunja.js](../../scripts/migrate-missing-to-vikunja.js) (new)

```javascript
/**
 * Migrate missing items from content checks to Vikunja
 * Run: node scripts/migrate-missing-to-vikunja.js
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

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

        const alreadyExists = existingTasks.some((t) =>
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
  } catch (error) {
    console.error('Error migrating missing items:', error);
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
```

---

## Implementation Steps

### Step 1: Create Analysis Script
1. Create [scripts/analyze-missing-items.js](../../scripts/analyze-missing-items.js)
2. Run analysis:
   ```bash
   node scripts/analyze-missing-items.js
   ```
3. Review generated report: `scripts/missing-items-report.json`

### Step 2: Review Report
1. Open `scripts/missing-items-report.json`
2. Verify games identified are correct
3. Check notes extraction is accurate
4. Note any false positives (e.g., "nothing missing")

### Step 3: Create Migration Script
1. Create [scripts/migrate-missing-to-vikunja.js](../../scripts/migrate-missing-to-vikunja.js)
2. Verify `VIKUNJA_API_TOKEN` is set in Railway environment
3. Test with a few games first (modify script to limit)

### Step 4: Run Migration
```bash
# Dry run first (optional - modify script to add --dry-run flag)
node scripts/migrate-missing-to-vikunja.js

# Check tasks created in Vikunja
# https://tasks.sipnplay.cafe/projects/1

# Verify tasks appear in staff dashboard
```

### Step 5: Verify Results
1. Check Vikunja "Observation Notes" project
2. Verify tasks have correct format
3. Verify tasks appear in staff dashboard
4. Test completing a task and earning points

### Step 6: Document and Commit
```bash
git add scripts/analyze-missing-items.js scripts/migrate-missing-to-vikunja.js
git commit -m "v1.5.6 - Add scripts to migrate missing items to Vikunja

- Analyze content checks for missing items
- Create Vikunja tasks for missing pieces
- Include reported date and reporter in task description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

### Analysis
- [ ] Analysis script runs successfully
- [ ] Report generated with correct data
- [ ] Games with missing items identified
- [ ] Notes extracted correctly
- [ ] False positives minimal

### Migration
- [ ] Vikunja API token works
- [ ] Tasks created in correct project
- [ ] Task format matches template
- [ ] Points label assigned (500 points)
- [ ] Complexity set correctly (2)
- [ ] Duplicate detection works

### Verification
- [ ] Tasks appear in Vikunja
- [ ] Tasks visible in staff dashboard
- [ ] Tasks can be completed
- [ ] Points awarded correctly
- [ ] Task removal from dashboard works

---

## Rollback Plan

If issues arise:
1. Delete created tasks from Vikunja manually
2. Review report for errors
3. Fix script issues
4. Re-run migration

---

## Estimated Timeline

- **Analysis Script**: 20 minutes
- **Review Report**: 15 minutes
- **Migration Script**: 30 minutes
- **Testing**: 30 minutes
- **Verification**: 15 minutes
- **Total**: ~2 hours

---

## Related Files

### New Scripts
- [scripts/analyze-missing-items.js](../../scripts/analyze-missing-items.js)
- [scripts/migrate-missing-to-vikunja.js](../../scripts/migrate-missing-to-vikunja.js)

### Related Services
- [lib/services/vikunja-service.ts](../../lib/services/vikunja-service.ts)
- [lib/services/content-checks-db-service.ts](../../lib/services/content-checks-db-service.ts)

---

## Notes

- Migration is one-time operation
- Duplicate detection prevents re-creating tasks
- Rate limiting prevents API throttling (1 second between requests)
- Consider archiving old content checks with resolved missing items (future)
- Report can be re-generated anytime to check for new missing items
- Use "Missing Pieces" issue type (matches Phase 3 issue reporting)
- Tasks created with 500 points (standard for missing pieces)
- Complexity set to 2 (medium difficulty)
