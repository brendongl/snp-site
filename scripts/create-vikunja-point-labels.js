/**
 * Create point value labels in Vikunja
 *
 * Usage: node scripts/create-vikunja-point-labels.js
 */

const TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';
const URL = 'https://tasks.sipnplay.cafe/api/v1';

const pointLabels = [
  { value: 100, color: '90EE90', description: 'Simple quick task' },
  { value: 200, color: '32CD32', description: 'Minor task' },
  { value: 500, color: '4169E1', description: 'Standard task' },
  { value: 1000, color: '1E90FF', description: 'Medium effort task' },
  { value: 2000, color: '00CED1', description: 'Complex game task' },
  { value: 5000, color: '9370DB', description: 'Major task' },
  { value: 10000, color: '8B008B', description: 'Large project' },
  { value: 20000, color: 'FF8C00', description: 'Major project' },
  { value: 50000, color: 'FF4500', description: 'Epic achievement' }
];

async function createLabel(points, hexColor, description) {
  const response = await fetch(`${URL}/labels`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: `points:${points}`,
      description: description,
      hex_color: hexColor
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Failed to create label for ${points} points: ${error}`);
    return null;
  }

  const label = await response.json();
  return label;
}

async function main() {
  console.log('\n🏷️  Creating Vikunja Point Labels...\n');

  for (const { value, color, description } of pointLabels) {
    const label = await createLabel(value, color, description);
    if (label) {
      console.log(`✅ Created: points:${value.toLocaleString()} (${description})`);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n✨ Point labels created successfully!\n');
  console.log('📝 How to use:');
  console.log('   1. Open a task in Vikunja');
  console.log('   2. Click "Labels" dropdown');
  console.log('   3. Search for "points:" and select appropriate value');
  console.log('   4. Only admins should assign point labels\n');
}

main();