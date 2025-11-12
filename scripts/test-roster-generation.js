/**
 * Script: Test Roster Generation (Phase 2)
 * Purpose: Test constraint solver and roster generation
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const BASE_URL = 'http://localhost:3000';

// Helper: Make API request
async function apiRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n${method} ${path}`);

  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      options.body = JSON.stringify(body);
      console.log('Request Body:', JSON.stringify(body, null, 2));
    }

    const response = await fetch(url, options);
    const data = await response.json();

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', JSON.stringify(data, null, 2).substring(0, 1000) + '...');

    return { status: response.status, data };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { status: 0, error: error.message };
  }
}

// Helper: Get next Monday
function getNextMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split('T')[0];
}

async function main() {
  console.log('🚀 Starting Phase 2 Roster Generation Tests\n');
  console.log('=' .repeat(60));

  const nextMonday = getNextMonday();
  console.log(`\nUsing week starting: ${nextMonday}\n`);

  // Get test staff member ID
  const staffResult = await pool.query('SELECT id, staff_name FROM staff_list ORDER BY staff_name LIMIT 1');
  const testStaffId = staffResult.rows[0]?.id;
  const testStaffName = staffResult.rows[0]?.staff_name;

  console.log(`Test staff: ${testStaffName} (${testStaffId})\n`);

  console.log('='.repeat(60));
  console.log('TEST 1: GET /api/roster/generate - Get generation info');
  console.log('='.repeat(60));

  await apiRequest('GET', '/api/roster/generate');

  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: POST /api/roster/generate - Generate roster with default requirements');
  console.log('='.repeat(60));

  const generateResult = await apiRequest('POST', '/api/roster/generate', {
    week_start: nextMonday,
    use_default_requirements: true,
    max_hours_per_week: 40,
    prefer_fairness: true,
    auto_save: false
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: POST /api/roster/generate - Generate and auto-save');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/roster/generate', {
    week_start: nextMonday,
    use_default_requirements: true,
    max_hours_per_week: 40,
    prefer_fairness: true,
    auto_save: true
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: GET /api/roster/rules/parse - Get rule parser info');
  console.log('='.repeat(60));

  await apiRequest('GET', '/api/roster/rules/parse');

  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: POST /api/roster/rules/parse - Parse simple rule (no save)');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/roster/rules/parse', {
    rule_text: `${testStaffName} should work no more than 35 hours per week`,
    auto_save: false
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: POST /api/roster/rules/parse - Parse and save rule');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/roster/rules/parse', {
    rule_text: `${testStaffName} prefers to work between 20 and 30 hours weekly`,
    created_by: testStaffId,
    auto_save: true,
    expires_at: '2025-12-31'
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 7: POST /api/roster/rules/parse - Parse fairness rule');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/roster/rules/parse', {
    rule_text: 'Try to keep hour distribution fair within 8 hours difference',
    created_by: testStaffId,
    auto_save: true
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 8: POST /api/roster/generate - Generate with new rules');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/roster/generate', {
    week_start: nextMonday,
    use_default_requirements: true,
    max_hours_per_week: 40,
    prefer_fairness: true,
    auto_save: false
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 9: Custom shift requirements');
  console.log('='.repeat(60));

  const customShifts = [
    {
      day_of_week: 'Monday',
      shift_type: 'opening',
      scheduled_start: '09:00',
      scheduled_end: '14:00',
      role_required: 'cafe',
      requires_keys: true
    },
    {
      day_of_week: 'Monday',
      shift_type: 'closing',
      scheduled_start: '18:00',
      scheduled_end: '22:00',
      role_required: 'floor',
      requires_keys: false
    }
  ];

  await apiRequest('POST', '/api/roster/generate', {
    week_start: nextMonday,
    shift_requirements: customShifts,
    max_hours_per_week: 40,
    prefer_fairness: true,
    auto_save: false
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ All Phase 2 tests complete!');
  console.log('='.repeat(60));

  await pool.end();
}

main().catch(console.error);
