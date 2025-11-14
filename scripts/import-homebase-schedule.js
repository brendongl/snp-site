/**
 * Import Homebase Schedule to Roster Calendar
 * Week: November 10-16, 2025
 *
 * This script:
 * 1. Fetches staff list to map names to IDs
 * 2. Clears all existing shifts for the week
 * 3. Creates all shifts from Homebase schedule
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3005';
const WEEK_START = '2025-11-10'; // Monday, November 10, 2025

// Homebase schedule data
const HOMEBASE_SHIFTS = [
  // Tho Nguyen Phuoc
  { staffName: 'Thọ', day: 'Monday', start: '18:00', end: '23:00', role: 'supervisor' },
  { staffName: 'Thọ', day: 'Tuesday', start: '12:30', end: '18:00', role: 'supervisor' },
  { staffName: 'Thọ', day: 'Wednesday', start: '16:00', end: '23:00', role: 'supervisor' },
  { staffName: 'Thọ', day: 'Thursday', start: '17:00', end: '23:00', role: 'supervisor' },
  { staffName: 'Thọ', day: 'Saturday', start: '09:00', end: '15:00', role: 'supervisor' },

  // Hieu Nguyen (HN)
  { staffName: 'Hiếu', day: 'Monday', start: '12:00', end: '18:00', role: 'supervisor' },
  { staffName: 'Hiếu', day: 'Tuesday', start: '17:00', end: '23:00', role: 'supervisor' },
  { staffName: 'Hiếu', day: 'Wednesday', start: '12:00', end: '18:00', role: 'supervisor' },
  { staffName: 'Hiếu', day: 'Thursday', start: '12:30', end: '18:00', role: 'supervisor' },
  { staffName: 'Hiếu', day: 'Friday', start: '09:00', end: '18:00', role: 'supervisor' },
  { staffName: 'Hiếu', day: 'Saturday', start: '09:00', end: '16:30', role: 'supervisor' },

  // Phong Chu (PC)
  { staffName: 'Phong', day: 'Monday', start: '19:30', end: '23:00', role: 'dealer' },
  { staffName: 'Phong', day: 'Tuesday', start: '12:30', end: '17:00', role: 'senior' },
  { staffName: 'Phong', day: 'Thursday', start: '16:00', end: '23:00', role: 'dealer' },
  { staffName: 'Phong', day: 'Friday', start: '18:00', end: '23:59', role: 'senior' }, // 6pm-12am
  { staffName: 'Phong', day: 'Saturday', start: '09:00', end: '17:00', role: 'senior' },
  { staffName: 'Phong', day: 'Sunday', start: '09:00', end: '16:00', role: 'senior' },

  // Le Huy
  { staffName: 'Huy', day: 'Friday', start: '18:00', end: '23:59', role: 'barista' }, // 6pm-12am
  { staffName: 'Huy', day: 'Saturday', start: '18:00', end: '23:59', role: 'barista' }, // 6pm-12am
  { staffName: 'Huy', day: 'Sunday', start: '18:00', end: '23:59', role: 'barista' }, // 6pm-12am

  // Nhi Nguyen
  { staffName: 'Nhi', day: 'Monday', start: '12:00', end: '16:00', role: 'barista' },
  { staffName: 'Nhi', day: 'Wednesday', start: '12:00', end: '16:00', role: 'barista' },
  { staffName: 'Nhi', day: 'Thursday', start: '12:30', end: '16:00', role: 'barista' },
  { staffName: 'Nhi', day: 'Friday', start: '12:00', end: '16:00', role: 'barista' },
  { staffName: 'Nhi', day: 'Saturday', start: '09:00', end: '16:00', role: 'barista' },
  { staffName: 'Nhi', day: 'Sunday', start: '09:00', end: '16:00', role: 'barista' },

  // Long Hoang Quang (LP)
  { staffName: 'Long', day: 'Sunday', start: '16:00', end: '23:59', role: 'barista' }, // 4pm-12am

  // Vu Thinh Van Hoang (VH)
  { staffName: 'Vũ', day: 'Thursday', start: '18:00', end: '23:00', role: 'game master' },
  { staffName: 'Vũ', day: 'Saturday', start: '12:00', end: '22:00', role: 'game master' },
  { staffName: 'Vũ', day: 'Sunday', start: '12:00', end: '22:00', role: 'game master' },

  // Chase Thanh Phong - Note: "Training" might not be a valid role, using "dealer" as fallback
  { staffName: 'Chase', day: 'Monday', start: '18:00', end: '23:00', role: 'dealer' }, // Training (Approved cover)
  { staffName: 'Chase', day: 'Tuesday', start: '18:00', end: '23:00', role: 'dealer' }, // Training
  { staffName: 'Chase', day: 'Wednesday', start: '18:00', end: '23:00', role: 'dealer' }, // Training
  { staffName: 'Chase', day: 'Friday', start: '17:00', end: '23:59', role: 'dealer' }, // 5pm-12am Training
  { staffName: 'Chase', day: 'Saturday', start: '17:00', end: '23:59', role: 'dealer' }, // 5pm-12am Training

  // Son Nguyen The
  { staffName: 'Sơn', day: 'Monday', start: '16:00', end: '23:00', role: 'dealer' }, // Training
  { staffName: 'Sơn', day: 'Friday', start: '09:00', end: '18:00', role: 'dealer' }, // Training

  // Minh Dang Nhat
  { staffName: 'Minh', day: 'Tuesday', start: '18:00', end: '23:00', role: 'barista' },
  { staffName: 'Minh', day: 'Wednesday', start: '18:00', end: '23:00', role: 'barista' },
  { staffName: 'Minh', day: 'Friday', start: '17:00', end: '22:00', role: 'game master' }, // Approved cover
  { staffName: 'Minh', day: 'Saturday', start: '15:00', end: '23:59', role: 'barista' }, // 3pm-12am
  { staffName: 'Minh', day: 'Sunday', start: '16:00', end: '23:59', role: 'barista' }, // 4pm-12am

  // An Pham
  { staffName: 'An', day: 'Wednesday', start: '18:00', end: '23:00', role: 'dealer' }, // Training
  { staffName: 'An', day: 'Sunday', start: '18:00', end: '23:59', role: 'dealer' }, // 6pm-12am Training
];

async function fetchStaffList() {
  console.log('Fetching staff list...');
  const response = await fetch(`${API_BASE}/api/staff-list`);

  if (!response.ok) {
    throw new Error(`Failed to fetch staff list: ${response.statusText}`);
  }

  const data = await response.json();
  const staffMap = new Map();

  // Map by nickname or name
  data.staff.forEach(member => {
    const displayName = member.nickname || member.name;
    staffMap.set(displayName, member.id);
    // Also map by full name
    staffMap.set(member.name, member.id);
  });

  console.log(`✓ Loaded ${staffMap.size} staff members`);
  return staffMap;
}

async function clearExistingShifts() {
  console.log(`\nClearing existing shifts for week of ${WEEK_START}...`);

  // Fetch current shifts
  const response = await fetch(`${API_BASE}/api/roster/shifts?week_start=${WEEK_START}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch shifts: ${response.statusText}`);
  }

  const data = await response.json();
  const shifts = data.shifts || [];

  if (shifts.length === 0) {
    console.log('✓ No existing shifts to clear');
    return;
  }

  console.log(`Found ${shifts.length} existing shifts, deleting...`);

  // Delete all shifts
  for (const shift of shifts) {
    const deleteResponse = await fetch(`${API_BASE}/api/roster/shifts/${shift.id}`, {
      method: 'DELETE'
    });

    if (!deleteResponse.ok) {
      console.warn(`⚠ Failed to delete shift ${shift.id}`);
    }
  }

  console.log(`✓ Cleared ${shifts.length} shifts`);
}

async function createShift(staffId, shift) {
  const response = await fetch(`${API_BASE}/api/roster/shifts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      staff_id: staffId,
      week_start: WEEK_START,
      day_of_week: shift.day,
      scheduled_start: shift.start,
      scheduled_end: shift.end,
      role_required: shift.role,
      shift_type: 'day'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create shift: ${error}`);
  }

  return await response.json();
}

async function importShifts(staffMap) {
  console.log(`\nImporting ${HOMEBASE_SHIFTS.length} shifts from Homebase...`);

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  for (const shift of HOMEBASE_SHIFTS) {
    const staffId = staffMap.get(shift.staffName);

    if (!staffId) {
      const error = `⚠ Staff not found: ${shift.staffName}`;
      console.log(error);
      errors.push(error);
      failCount++;
      continue;
    }

    try {
      await createShift(staffId, shift);
      successCount++;
      process.stdout.write('.');
    } catch (err) {
      const error = `⚠ Failed to create shift for ${shift.staffName} on ${shift.day}: ${err.message}`;
      console.log(`\n${error}`);
      errors.push(error);
      failCount++;
    }
  }

  console.log(`\n\n✓ Successfully imported ${successCount} shifts`);

  if (failCount > 0) {
    console.log(`✗ Failed to import ${failCount} shifts:\n`);
    errors.forEach(err => console.log(`  ${err}`));
  }
}

async function main() {
  console.log('=== Import Homebase Schedule ===');
  console.log(`Week: ${WEEK_START}`);
  console.log(`API Base: ${API_BASE}\n`);

  try {
    // Step 1: Fetch staff list
    const staffMap = await fetchStaffList();

    // Step 2: Clear existing shifts
    await clearExistingShifts();

    // Step 3: Import new shifts
    await importShifts(staffMap);

    console.log('\n✓ Import complete!');
    console.log(`\nView the roster at: ${API_BASE}/staff/roster/calendar`);

  } catch (error) {
    console.error('\n✗ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
