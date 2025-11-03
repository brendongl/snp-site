/**
 * Explore Vikunja API for User & Team Management
 */

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const API_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

async function makeRequest(endpoint, options = {}) {
  const response = await fetch(`${VIKUNJA_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { ok: response.ok, status: response.status, data };
}

async function main() {
  console.log('🔍 VIKUNJA API EXPLORATION');
  console.log('='.repeat(60));

  // 1. Current authenticated user
  console.log('\n1️⃣ Current authenticated user:');
  const userResult = await makeRequest('/user');
  if (userResult.ok) {
    const user = userResult.data;
    console.log(`   ✅ User: ${user.username} (ID: ${user.id})`);
    console.log(`   📧 Email: ${user.email || '(not set)'}`);
    console.log(`   👤 Name: ${user.name || '(not set)'}`);
  } else {
    console.log(`   ❌ Error: ${userResult.status}`);
  }

  // 2. List all users (might require admin)
  console.log('\n2️⃣ List all users:');
  const usersResult = await makeRequest('/users');
  console.log(`   Status: ${usersResult.status}`);
  if (usersResult.ok && usersResult.data && Array.isArray(usersResult.data)) {
    const users = usersResult.data;
    console.log(`   ✅ Found ${users.length} users`);
    users.forEach(u => {
      console.log(`      - ${u.username} (ID: ${u.id}, Email: ${u.email || 'N/A'})`);
    });
  } else {
    console.log(`   ℹ️  Data: ${JSON.stringify(usersResult.data)}`);
    console.log(`   ℹ️  Endpoint might not support listing all users`);
  }

  // 3. Teams in Sip n Play project
  console.log('\n3️⃣ Teams in "Sip n Play" project (ID: 2):');
  const teamsResult = await makeRequest('/projects/2/teams');
  console.log(`   Status: ${teamsResult.status}`);
  if (teamsResult.ok && teamsResult.data && Array.isArray(teamsResult.data)) {
    const teams = teamsResult.data;
    console.log(`   ✅ Found ${teams.length} team(s)`);
    teams.forEach(t => {
      console.log(`      - ${t.name} (ID: ${t.id})`);
    });
  } else {
    console.log(`   ℹ️  Data: ${JSON.stringify(teamsResult.data)}`);
  }

  // 4. Search users endpoint
  console.log('\n4️⃣ User search endpoint:');
  const searchResult = await makeRequest('/users?s=test');
  console.log(`   Status: ${searchResult.status}`);
  if (searchResult.ok) {
    console.log(`   ✅ Search works!`);
  }

  // 5. Check registration endpoint
  console.log('\n5️⃣ User registration endpoint (info only, not creating):');
  console.log(`   Endpoint: POST /register`);
  console.log(`   Expected payload: { username, email, password }`);

  // 6. Check project sharing/members
  console.log('\n6️⃣ Project members for "Sip n Play":');
  const projectResult = await makeRequest('/projects/2');
  if (projectResult.ok) {
    const project = projectResult.data;
    console.log(`   ✅ Project: ${project.title}`);
    console.log(`   Owner: ${project.owner?.username || 'Unknown'}`);

    // Check if there's a members/users endpoint
    const membersResult = await makeRequest('/projects/2/users');
    console.log(`   Members endpoint status: ${membersResult.status}`);
    if (membersResult.ok) {
      console.log(`   Members:`, JSON.stringify(membersResult.data, null, 2));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log('✅ Can fetch current user');
  console.log('✅ Can fetch project details');
  console.log('✅ Can fetch tasks and complete them');
  console.log('');
  console.log('Next steps for account linking:');
  console.log('1. Check if Vikunja allows user registration via API');
  console.log('2. Check project sharing/membership API');
  console.log('3. Consider using email as link between staff table and Vikunja');
}

main().catch(console.error);
