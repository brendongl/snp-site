/**
 * Script: Test Rostering API Endpoints
 * Purpose: Systematically test all 6 Phase 1 API endpoints
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
    console.log('Response:', JSON.stringify(data, null, 2));

    return { status: response.status, data };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { status: 0, error: error.message };
  }
}

// Helper: Get test data from database
async function getTestData() {
  console.log('\n📊 Fetching test data from database...');

  const staff = await pool.query('SELECT id, staff_name FROM staff_list ORDER BY staff_name LIMIT 3');
  const shifts = await pool.query('SELECT id, staff_id, day_of_week, scheduled_start FROM roster_shifts ORDER BY day_of_week LIMIT 3');

  console.log('Staff Members:');
  staff.rows.forEach(s => console.log(`  - ${s.staff_name}: ${s.id}`));

  console.log('\nShifts:');
  shifts.rows.forEach(s => console.log(`  - ${s.day_of_week} ${s.scheduled_start}: ${s.id}`));

  return {
    staffIds: staff.rows.map(s => s.id),
    shiftIds: shifts.rows.map(s => s.id),
    shifts: shifts.rows
  };
}

// Helper: Get current Monday
function getCurrentMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);
  return monday.toISOString().split('T')[0];
}

async function main() {
  console.log('🚀 Starting Rostering API Tests\n');
  console.log('=' .repeat(60));

  const testData = await getTestData();
  const weekStart = getCurrentMonday();
  const staffId = testData.staffIds[0];
  const shiftId = testData.shiftIds[0];

  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: GET /api/roster/[week] - Fetch roster for current week');
  console.log('='.repeat(60));

  await apiRequest('GET', `/api/roster/${weekStart}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: GET /api/roster/[week] - Invalid date (should return 400)');
  console.log('='.repeat(60));

  await apiRequest('GET', `/api/roster/2025-01-15`); // Wednesday, not Monday

  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: GET /api/clock-in - Check clock status (not clocked in)');
  console.log('='.repeat(60));

  await apiRequest('GET', `/api/clock-in?staff_id=${staffId}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: POST /api/clock-in - Clock in (early by 5 min, should get +50 points)');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/clock-in', {
    staff_id: staffId,
    shift_id: shiftId,
    action: 'clock-in',
    gps_latitude: 10.762622,
    gps_longitude: 106.660172
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: GET /api/clock-in - Check clock status (now clocked in)');
  console.log('='.repeat(60));

  await apiRequest('GET', `/api/clock-in?staff_id=${staffId}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST 6: POST /api/clock-in - Clock out');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/clock-in', {
    staff_id: staffId,
    action: 'clock-out'
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 7: GET /api/staff/availability - Get staff availability');
  console.log('='.repeat(60));

  await apiRequest('GET', `/api/staff/availability?staff_id=${staffId}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST 8: POST /api/staff/availability - Bulk update availability');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/staff/availability', {
    staff_id: staffId,
    availability: [
      {
        day_of_week: 'Monday',
        hour_start: 9,
        hour_end: 17,
        availability_status: 'available'
      },
      {
        day_of_week: 'Tuesday',
        hour_start: 9,
        hour_end: 17,
        availability_status: 'preferred_not'
      }
    ]
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 9: PUT /api/roster/[week] - Create shifts (bulk)');
  console.log('='.repeat(60));

  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStart = nextWeek.toISOString().split('T')[0];

  await apiRequest('PUT', `/api/roster/${nextWeekStart}`, {
    shifts: [
      {
        staff_id: staffId,
        day_of_week: 'Monday',
        shift_type: 'opening',
        scheduled_start: '09:00',
        scheduled_end: '14:00',
        role_required: 'cafe'
      }
    ],
    replaceAll: false
  });

  console.log('\n' + '='.repeat(60));
  console.log('TEST 10: DELETE /api/roster/[week] - Delete week\'s roster');
  console.log('='.repeat(60));

  await apiRequest('DELETE', `/api/roster/${nextWeekStart}`);

  console.log('\n' + '='.repeat(60));
  console.log('TEST 11: POST /api/cron/export-hours - Manual cron trigger');
  console.log('='.repeat(60));

  await apiRequest('POST', '/api/cron/export-hours');

  console.log('\n' + '='.repeat(60));
  console.log('✅ All API tests complete!');
  console.log('='.repeat(60));

  await pool.end();
}

main().catch(console.error);
