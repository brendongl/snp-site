/**
 * Parse and Store Roster Rules
 *
 * Takes natural language roster rules and:
 * 1. Parses them using Claude API
 * 2. Validates the parsed constraints
 * 3. Stores them in roster_rules table with correct priorities
 */

const pool = require('../lib/db/postgres').default;
const RuleParserService = require('../lib/services/rule-parser-service').default;

// User's actual roster rules organized by priority
const ROSTER_RULES = {
  critical: [
    'There must always be at least 2 staff members on at any given time',
    'We must have staff start 12pm on Monday, Wednesday',
    'We must have staff start 12:30pm Tuesday, Thursday',
    'We must have staff start 9:30am Friday',
    'We must have staff start 9am Saturday and Sunday',
    'We must have at least 2 staff closing at all times',
    'There should only be 2 staff on Monday to Friday open time until 3pm'
  ],
  high: [
    'Each staff members shift should be at least 5 hours long',
    'No staff member should be working an entire day + night',
    'We should have a game-master staff member on friday, saturday, and sunday night',
    'We must have at least 4 staff members on from 7pm onwards on saturday',
    'Tho should have at least 40 hours',
    'Hieu should have at least 40 hours'
  ],
  medium: [
    'Balance the staff members hours as much as possible',
    'All staff should be rostered on at least once per week'
  ],
  low: [
    'Nhi and Hieu should not be working together',
    'At least one Barista highest level must be on at all times'
  ]
};

// Weight mapping
const PRIORITY_WEIGHTS = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25
};

async function main() {
  const client = await pool.connect();

  try {
    console.log('=== Parse and Store Roster Rules ===\n');

    // Fetch staff context for name→ID mapping
    console.log('Fetching staff list for context...');
    const staffResult = await client.query('SELECT id, name, nickname FROM staff_list');
    const staffContext = staffResult.rows.map(row => ({
      id: row.id,
      staff_name: row.nickname || row.name
    }));
    console.log(`✓ Loaded ${staffContext.length} staff members\n`);

    // Clear existing rules
    console.log('Clearing existing roster rules...');
    const deleteResult = await client.query('DELETE FROM roster_rules WHERE true');
    console.log(`✓ Deleted ${deleteResult.rowCount} existing rules\n`);

    let totalParsed = 0;
    let totalStored = 0;
    let totalFailed = 0;

    // Process each priority level
    for (const [priority, rules] of Object.entries(ROSTER_RULES)) {
      console.log(`\n📋 Processing ${priority.toUpperCase()} priority rules (${rules.length} rules):`);
      console.log('─'.repeat(60));

      for (const ruleText of rules) {
        try {
          console.log(`\n  Parsing: "${ruleText}"`);

          // Parse rule using Claude API
          const parseResult = await RuleParserService.parseRule(ruleText, staffContext);
          totalParsed++;

          if (!parseResult.success || !parseResult.parsed_constraint) {
            console.log(`  ❌ Failed to parse: ${parseResult.error || 'Unknown error'}`);
            totalFailed++;
            continue;
          }

          const constraint = parseResult.parsed_constraint;
          const suggestedWeight = parseResult.suggested_weight;
          const explanation = parseResult.explanation;

          // Override weight with our priority system
          const weight = PRIORITY_WEIGHTS[priority];

          // Validate constraint
          const validation = RuleParserService.validateConstraint(constraint);
          if (!validation.is_valid) {
            console.log(`  ❌ Invalid constraint: ${validation.errors.join(', ')}`);
            totalFailed++;
            continue;
          }

          // Store in database
          await client.query(`
            INSERT INTO roster_rules (
              rule_text,
              constraint_type,
              constraint_json,
              weight,
              is_active,
              expires_at,
              created_by
            ) VALUES ($1, $2, $3, $4, true, NULL, 'system')
          `, [
            ruleText,
            constraint.type,
            JSON.stringify(constraint),
            weight
          ]);

          console.log(`  ✓ Stored: ${constraint.type} (weight: ${weight})`);
          console.log(`    Explanation: ${explanation}`);
          console.log(`    Claude suggested weight: ${suggestedWeight}`);
          totalStored++;

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.log(`  ❌ Error processing rule: ${error.message}`);
          totalFailed++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Rule parsing complete!');
    console.log(`  Total rules: ${totalParsed}`);
    console.log(`  Successfully stored: ${totalStored}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log('='.repeat(60));

    // Display summary
    const summaryResult = await client.query(`
      SELECT
        constraint_type,
        COUNT(*) as count,
        AVG(weight) as avg_weight
      FROM roster_rules
      WHERE is_active = true
      GROUP BY constraint_type
      ORDER BY avg_weight DESC
    `);

    console.log('\n📊 Rules Summary by Type:');
    console.log('─'.repeat(60));
    for (const row of summaryResult.rows) {
      console.log(`  ${row.constraint_type.padEnd(30)} ${row.count} rules (avg weight: ${Math.round(row.avg_weight)})`);
    }

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
main();
