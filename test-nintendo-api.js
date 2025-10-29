/**
 * Test Nintendo EU API response
 */

async function testAPI() {
  const gameName = 'Mario Kart 8 Deluxe';
  const searchUrl = `https://searching.nintendo-europe.com/en/select?q=${encodeURIComponent(gameName)}&fq=type:GAME AND system_type:nintendoswitch*&wt=json&rows=1`;

  console.log('Testing Nintendo EU API with:', gameName);
  console.log('URL:', searchUrl);
  console.log('');

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      console.log('ERROR: API returned non-200 status');
      return;
    }

    const data = await response.json();
    const game = data?.response?.docs?.[0];

    if (!game) {
      console.log('ERROR: No game found in response');
      console.log('Response:', JSON.stringify(data, null, 2));
      return;
    }

    console.log('\n✓ Game found:', game.title);
    console.log('\nScreenshot fields available:');
    console.log('- screenshot_image_url_h2x1_s:', game.screenshot_image_url_h2x1_s || 'NONE');
    console.log('- gallery_image_url:', game.gallery_image_url || 'NONE');
    console.log('- image_url_h2x1_s:', game.image_url_h2x1_s || 'NONE');
    console.log('- hero_banner_url:', game.hero_banner_url || 'NONE');

    if (game.screenshot_image_url_h2x1_s && game.screenshot_image_url_h2x1_s.length > 0) {
      console.log('\n✓ Found', game.screenshot_image_url_h2x1_s.length, 'screenshot URLs');
    }

    if (game.gallery_image_url && game.gallery_image_url.length > 0) {
      console.log('✓ Found', game.gallery_image_url.length, 'gallery URLs');
      console.log('First gallery URL:', game.gallery_image_url[0]);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

testAPI();
