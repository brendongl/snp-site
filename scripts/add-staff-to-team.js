/**
 * Add All Staff Members to "Sip n Play" Team in Vikunja
 *
 * Prerequisites:
 * - Run create-vikunja-accounts.js first
 * - All staff must have vikunja_user_id set in staff_list table
 *
 * This script adds staff members to the "Sip n Play" team (ID: 1)
 * so they can access tasks in the "Sip n Play" project.
 */

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const API_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';
const TEAM_ID = 1; // "Sip n Play" team

/**
 * Add user to team
 */
async function addUserToTeam(vikunjaUserId, username) {
  const response = await fetch(`${VIKUNJA_URL}/teams/${TEAM_ID}/members`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: username
    })
  });

  if (!response.ok) {
    const error = await response.text();

    // Check if user is already a member
    if (response.status === 400 && error.includes('already a member')) {
      return { alreadyMember: true };
    }

    throw new Error(`Failed to add ${username}: ${error}`);
  }

  return await response.json();
}

/**
 * Get current team members
 */
async function getTeamMembers() {
  const response = await fetch(`${VIKUNJA_URL}/teams/${TEAM_ID}`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch team: ${response.status}`);
  }

  const team = await response.json();
  return team.members || [];
}

async function main() {
  console.log('👥 ADD STAFF TO "SIP N PLAY" TEAM');
  console.log('='.repeat(70));
  console.log('');

  // Get existing team members
  console.log('1️⃣ Fetching current team members...');
  const existingMembers = await getTeamMembers();
  console.log(`   Current members: ${existingMembers.length}`);
  console.log('');

  // Fetch all staff with Vikunja accounts
  const result = await pool.query(`
    SELECT
      id,
      staff_name as name,
      vikunja_user_id,
      vikunja_username
    FROM staff_list
    WHERE vikunja_user_id IS NOT NULL
    ORDER BY staff_name
  `);

  if (result.rows.length === 0) {
    console.log('⚠️  No staff members have Vikunja accounts yet!');
    console.log('   Run: node scripts/create-vikunja-accounts.js first');
    await pool.end();
    return;
  }

  console.log(`2️⃣ Adding ${result.rows.length} staff member(s) to team...`);
  console.log('');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const staff of result.rows) {
    console.log(`👤 ${staff.name} (@${staff.vikunja_username})`);

    // Check if already a member
    const alreadyInTeam = existingMembers.some(m => m.id === staff.vikunja_user_id);

    if (alreadyInTeam) {
      console.log(`   ✓ Already in team`);
      skipCount++;
    } else {
      try {
        const result = await addUserToTeam(staff.vikunja_user_id, staff.vikunja_username);

        if (result.alreadyMember) {
          console.log(`   ✓ Already in team`);
          skipCount++;
        } else {
          console.log(`   ✅ Added to team!`);
          successCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('');
  }

  console.log('='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successfully added: ${successCount}`);
  console.log(`✓ Already members: ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('');

  if (successCount > 0 || skipCount > 0) {
    console.log('✨ All staff can now:');
    console.log('   - Access tasks in "Sip n Play" project');
    console.log('   - View tasks on Staff Dashboard');
    console.log('   - Complete tasks and earn points');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Share Vikunja login credentials with staff');
    console.log('2. Staff should log in and change their passwords');
    console.log('3. Create tasks and assign to staff members');
    console.log('4. Test task completion → points tracking');
  }

  await pool.end();
}

main().catch(error => {
  console.error('❌ Fatal Error:', error);
  pool.end();
  process.exit(1);
});
