const TOKEN = 'tk_e396533971cba5f0873c21900a49ecd136602c77';
const URL = 'https://tasks.sipnplay.cafe/api/v1';

async function listLabels() {
  const response = await fetch(`${URL}/labels`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
  });

  const labels = await response.json();

  console.log('\n📋 Point Labels in Vikunja:\n');
  labels
    .filter(l => l.title.startsWith('points:'))
    .sort((a, b) => {
      const aVal = parseInt(a.title.replace('points:', ''));
      const bVal = parseInt(b.title.replace('points:', ''));
      return aVal - bVal;
    })
    .forEach(l => {
      const points = l.title.replace('points:', '');
      console.log(`  ${l.id}: points:${points}`);
    });
  console.log('');
}

listLabels();
