const gameName = 'Mario Party Superstars';

(async () => {
  console.log('Testing gaming database APIs...\n');

  // Test 1: RAWG.io (free API with images)
  console.log('1. RAWG.io API');
  try {
    const searchUrl = `https://api.rawg.io/api/games?search=${encodeURIComponent(gameName)}&platforms=7`; // 7 = Nintendo Switch
    console.log('URL:', searchUrl);

    const response = await fetch(searchUrl);
    console.log('Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const game = data.results[0];
        console.log('✅ Game found:', game.name);
        console.log('Background image:', game.background_image);
        console.log('Screenshots available:', game.short_screenshots ? game.short_screenshots.length : 0);
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test 2: IGDB (free API, requires key)
  console.log('\n2. IGDB API (no key test)');
  try {
    const url = 'https://api.igdb.com/v4/games';
    const response = await fetch(url);
    console.log('Status:', response.status);
    console.log('(Requires API key)');
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test 3: GiantBomb
  console.log('\n3. GiantBomb API (no key test)');
  try {
    const url = `https://www.giantbomb.com/api/search/?api_key=test&format=json&query=${encodeURIComponent(gameName)}&resources=game`;
    const response = await fetch(url);
    console.log('Status:', response.status);
    console.log('(Requires API key)');
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test 4: Try SteamGridDB (has console games too)
  console.log('\n4. SteamGridDB');
  try {
    const url = 'https://www.steamgriddb.com/api/v2/search/autocomplete/mario%20party';
    const response = await fetch(url);
    console.log('Status:', response.status);
    console.log('(May require API key)');
  } catch (error) {
    console.log('Error:', error.message);
  }
})();
