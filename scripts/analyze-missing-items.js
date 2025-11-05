/**
 * Analyze content checks for missing items
 * Run: node scripts/analyze-missing-items.js
 */

import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

async function analyzeMissingItems() {
  try {
    console.log('Analyzing content checks for missing items...\n');

    // Query all content checks with "missing" in notes (case-insensitive)
    const result = await pool.query(`
      SELECT
        cc.id,
        cc.game_record_id,
        cc.checked_date,
        cc.status,
        cc.notes,
        cc.inspector,
        g.fields->>'Game Name' as game_name,
        g.fields->>'BGG ID' as bgg_id
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_record_id = g.id
      WHERE LOWER(cc.notes) LIKE '%missing%'
      ORDER BY cc.checked_date DESC
    `);

    console.log(`Found ${result.rowCount} content checks with 'missing' in notes\n`);

    if (result.rowCount === 0) {
      console.log('No missing items found.');
      await pool.end();
      return;
    }

    // Group by game
    const byGame = new Map();

    result.rows.forEach((check) => {
      if (!byGame.has(check.game_record_id)) {
        byGame.set(check.game_record_id, {
          game_id: check.game_record_id,
          game_name: check.game_name,
          bgg_id: check.bgg_id,
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

    await pool.end();
    return report;
  } catch (error) {
    console.error('Error analyzing missing items:', error);
    await pool.end();
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
