/**
 * Load Roster Rules via API
 *
 * Uses the POST /api/roster/rules endpoint to parse and store
 * all roster rules using Claude API
 */

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

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function loadRule(ruleText, priority) {
  try {
    const response = await fetch(`${API_BASE}/api/roster/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_text: ruleText,
        suggested_priority: priority
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.details || 'Failed to create rule');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

async function main() {
  console.log('=== Load Roster Rules via API ===\n');
  console.log(`API Base: ${API_BASE}\n`);

  let totalRules = 0;
  let successCount = 0;
  let failCount = 0;

  for (const [priority, rules] of Object.entries(ROSTER_RULES)) {
    console.log(`\n📋 ${priority.toUpperCase()} Priority (${rules.length} rules):`);
    console.log('─'.repeat(60));

    for (const ruleText of rules) {
      totalRules++;
      console.log(`\n  "${ruleText}"`);

      try {
        const result = await loadRule(ruleText, priority);

        console.log(`  ✅ Created: ${result.parsing_details.constraint_type}`);
        console.log(`     Weight: ${result.parsing_details.applied_weight}`);
        console.log(`     ${result.parsing_details.explanation}`);

        successCount++;

        // Rate limiting: 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
        failCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✓ Rule loading complete!');
  console.log(`  Total: ${totalRules}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log('='.repeat(60));

  console.log('\n📊 View rules at: http://localhost:3001/api/roster/rules');
}

main().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
