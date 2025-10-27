const titleId = '01006FE013472000';

(async () => {
  console.log('Scraping DekuDeals for game images...\n');

  const url = `https://www.dekudeals.com/items/${titleId}`;
  console.log('URL:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log('Status:', response.status);

    if (response.ok) {
      const html = await response.text();

      // Look for OpenGraph images (og:image)
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (ogImage) {
        console.log('\n✅ Found OG Image:', ogImage[1]);
      }

      // Look for main game image
      const gameImage = html.match(/<img[^>]+class="[^"]*game-image[^"]*"[^>]+src="([^"]+)"/);
      if (gameImage) {
        console.log('✅ Found Game Image:', gameImage[1]);
      }

      // Look for all dekudeals image URLs
      const dekuImages = html.match(/https:\/\/assets\.dekudeals\.com\/images\/[^\s"']+\.(jpg|jpeg|png|webp)/gi);
      if (dekuImages) {
        console.log('\n✅ Found DekuDeals images:');
        const unique = [...new Set(dekuImages)].slice(0, 5);
        unique.forEach((url, i) => {
          console.log(`  ${i + 1}. ${url}`);
        });
      }

      // Test if we can download one
      if (ogImage) {
        console.log('\nTesting download...');
        const testResponse = await fetch(ogImage[1]);
        console.log('Download status:', testResponse.status);
        if (testResponse.ok) {
          const buffer = await testResponse.arrayBuffer();
          console.log('✅ Successfully downloaded:', buffer.byteLength, 'bytes');
        }
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
})();
