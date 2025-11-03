/**
 * Display Vikunja project summary
 */

const VIKUNJA_URL = 'https://tasks.sipnplay.cafe/api/v1';
const VIKUNJA_TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';

async function vikunjaRequest(endpoint) {
  const response = await fetch(`${VIKUNJA_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${VIKUNJA_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function main() {
  const projects = {
    2: 'Sip n Play (Parent)',
    3: 'Cleaning',
    4: 'Maintenance',
    7: 'Admin',
    8: 'Inventory',
    9: 'Events & Marketing'
  };

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Vikunja Task Distribution Summary             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const stats = {};

  for (const [id, name] of Object.entries(projects)) {
    const tasks = await vikunjaRequest(`/projects/${id}/tasks?per_page=500`);
    const activeTasks = tasks.filter(t => !t.done);
    const completedTasks = tasks.filter(t => t.done);

    stats[name] = {
      total: tasks.length,
      active: activeTasks.length,
      completed: completedTasks.length
    };

    console.log(`📁 ${name}`);
    console.log(`   Total: ${tasks.length} | Active: ${activeTasks.length} | Completed: ${completedTasks.length}`);
    console.log('');
  }

  const totalTasks = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const totalActive = Object.values(stats).reduce((sum, s) => sum + s.active, 0);
  const totalCompleted = Object.values(stats).reduce((sum, s) => sum + s.completed, 0);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎯 Grand Total: ${totalTasks} tasks`);
  console.log(`   Active: ${totalActive} | Completed: ${totalCompleted}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📂 Project Structure:');
  console.log('   Sip n Play (Parent) - One-off tasks');
  console.log('   ├── Admin - Rent, payments, staff, handyman');
  console.log('   ├── Cleaning - All cleaning tasks');
  console.log('   ├── Maintenance - Equipment, AC, consoles');
  console.log('   ├── Inventory - Stock, purchases, orders');
  console.log('   └── Events & Marketing - Menu, promotions, social');
}

main().catch(console.error);
