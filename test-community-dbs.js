const titleId = '01006FE013472000';

(async () => {
  console.log('Testing community databases for image URLs...\n');

  // Test 1: Check if fulldb.json has any image references
  console.log('1. Checking NX-DB fulldb.json...');
  try {
    const response = await fetch('https://raw.githubusercontent.com/ghost-land/NX-DB/main/fulldb.json');
    console.log('Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      const game = data.find(g => g.id === titleId);

      if (game) {
        console.log('✅ Game found:', game.name);
        console.log('Fields:', Object.keys(game).join(', '));

        // Check for any URL fields
        Object.keys(game).forEach(key => {
          if (typeof game[key] === 'string' && (game[key].startsWith('http') || game[key].includes('image'))) {
            console.log(`  ${key}: ${game[key]}`);
          }
        });
      } else {
        console.log('Game not found in database');
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  console.log('\n2. Trying direct CDN patterns...');

  // Test direct CDN URLs that might work
  const cdnTests = [
    `https://fs.blawar.xyz/${titleId}.jpg`,
    `https://tinfoil.media/ti/${titleId}`,
    `https://db.switchbase.org/images/${titleId}.jpg`,
   `https://raw.githubusercontent.com/ghost-land/NX-DB/main/images/${titleId}.jpg`,
  ];

  for (const url of cdnTests) {
    console.log(`Testing: ${url}`);
    try {
      const response = await fetch(url);
      console.log(`  Status: ${response.status}`);

      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log(`  ✅ SUCCESS! Downloaded ${buffer.byteLength} bytes`);
        break;
      }
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
})();
