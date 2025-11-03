/**
 * Create Vikunja User Accounts for All Staff Members
 *
 * This script:
 * 1. Fetches all staff members from database
 * 2. Creates Vikunja user accounts via registration API
 * 3. Updates staff_list table with vikunja_user_id and vikunja_username
 * 4. Generates temporary passwords that users can change
 *
 * IMPORTANT: Run this script ONCE. It will skip users that already have vikunja_user_id set.
 */

const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';

/**
 * Generate username from staff name
 * Vikunja requirements: alphanumeric, hyphens, underscores only
 * Example: "Brendon Gan-Le" → "brendon_ganle"
 */
function generateUsername(name) {
  return name
    .toLowerCase()
    .normalize('NFD') // Normalize Vietnamese characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd') // Replace đ with d
    .replace(/[^a-z0-9\s-]/g, '') // Keep only alphanumeric, spaces, hyphens
    .trim()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-+/g, '_'); // Replace hyphens with underscores
}

/**
 * Generate secure random password
 */
function generatePassword() {
  return crypto.randomBytes(12).toString('base64').slice(0, 16);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Register a new Vikunja user
 */
async function registerVikunjaUser(username, email, password) {
  const response = await fetch(`${VIKUNJA_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      email,
      password
    })
  });

  const data = await response.json();

  if (!response.ok) {
    // Check if user already exists
    if (response.status === 400 && data.message?.includes('already exists')) {
      return { alreadyExists: true, message: data.message };
    }
    throw new Error(`Failed to register ${username}: ${JSON.stringify(data)}`);
  }

  return {
    id: data.id,
    username: data.username,
    email: data.email
  };
}

/**
 * Update staff_list with Vikunja user info
 */
async function updateStaffVikunjaId(staffId, vikunjaUserId, vikunjaUsername) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE staff_list
       SET vikunja_user_id = $1, vikunja_username = $2
       WHERE id = $3`,
      [vikunjaUserId, vikunjaUsername, staffId]
    );
  } finally {
    client.release();
  }
}

async function main() {
  console.log('🎯 VIKUNJA USER ACCOUNT CREATION');
  console.log('='.repeat(70));
  console.log('');

  // Fetch all staff members
  const result = await pool.query(`
    SELECT
      id,
      staff_name as name,
      staff_email as email,
      vikunja_user_id,
      vikunja_username
    FROM staff_list
    WHERE staff_email IS NOT NULL
    ORDER BY staff_name
  `);

  const toCreate = result.rows.filter(s => !s.vikunja_user_id);
  const alreadyCreated = result.rows.filter(s => s.vikunja_user_id);

  if (alreadyCreated.length > 0) {
    console.log('✅ Already have Vikunja accounts:');
    alreadyCreated.forEach(s => {
      console.log(`   - ${s.name} (@${s.vikunja_username})`);
    });
    console.log('');
  }

  if (toCreate.length === 0) {
    console.log('✨ All staff members already have Vikunja accounts!');
    console.log('');
    await pool.end();
    return;
  }

  console.log(`📝 Creating Vikunja accounts for ${toCreate.length} staff member(s):`);
  console.log('');

  const credentials = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const staff of toCreate) {
    const username = generateUsername(staff.name);
    const password = generatePassword();

    console.log(`👤 ${staff.name}`);
    console.log(`   Username: @${username}`);
    console.log(`   Email: ${staff.email}`);

    try {
      const result = await registerVikunjaUser(username, staff.email, password);

      if (result.alreadyExists) {
        console.log(`   ⚠️  User already exists in Vikunja (skipping)`);
        console.log(`   Note: You may need to manually link this account`);
        skipCount++;
      } else {
        // Update staff_list with Vikunja user ID
        await updateStaffVikunjaId(staff.id, result.id, result.username);

        console.log(`   ✅ Account created!`);
        console.log(`   Vikunja User ID: ${result.id}`);

        credentials.push({
          name: staff.name,
          username: result.username,
          email: staff.email,
          password: password,
          vikunjaUserId: result.id
        });

        successCount++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    }

    console.log('');

    // Wait 2 seconds between registrations to avoid rate limiting
    if (toCreate.indexOf(staff) < toCreate.length - 1) {
      await sleep(2000);
    }
  }

  console.log('='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully created: ${successCount}`);
  console.log(`⚠️  Skipped (already exists): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('');

  if (credentials.length > 0) {
    console.log('🔐 TEMPORARY CREDENTIALS (SAVE THESE!)');
    console.log('='.repeat(70));
    console.log('');
    console.log('Share these credentials with each staff member:');
    console.log('');

    credentials.forEach((cred, i) => {
      console.log(`${i + 1}. ${cred.name}`);
      console.log(`   Login URL: https://tasks.sipnplay.cafe`);
      console.log(`   Username: ${cred.username}`);
      console.log(`   Password: ${cred.password}`);
      console.log(`   → Ask staff to change password on first login!`);
      console.log('');
    });

    console.log('⚠️  SECURITY REMINDER:');
    console.log('- These are temporary passwords');
    console.log('- Staff MUST change passwords on first login');
    console.log('- Passwords are displayed ONLY ONCE (save them now!)');
    console.log('');
  }

  console.log('📋 Next steps:');
  console.log('1. Share credentials with each staff member');
  console.log('2. Add all users to "Sip n Play" team (run add-staff-to-team.js)');
  console.log('3. Staff should log in and change their passwords');

  await pool.end();
}

main().catch(error => {
  console.error('❌ Fatal Error:', error);
  pool.end();
  process.exit(1);
});
