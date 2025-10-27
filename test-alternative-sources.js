const titleId = '01006FE013472000'; // Mario Party Superstars
const nsuid = '70010000042934';

(async () => {
  console.log('Testing alternative image sources for Switch games...\n');

  // Test different sources
  const sources = [
    // Nintendo eShop API (via proxy)
    {
      name: 'Nintendo eShop API (US)',
      url: `https://ec.nintendo.com/api/US/en/search/sales?q=*&sort=score&nsuid=${nsuid}`,
      type: 'json'
    },
    // EC API direct
    {
      name: 'EC Nintendo API',
      url: `https://ec.nintendo.com/apps/${nsuid}/US`,
      type: 'html'
    },
    // IGDB (via screenshot)
    {
      name: 'IGDB Cache',
      url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${titleId}.jpg`,
      type: 'image'
    },
    // Dekudeals
    {
      name: 'DekuDeals',
      url: `https://www.dekudeals.com/items/${titleId}`,
      type: 'html'
    },
    // SwitchDB
    {
      name: 'SwitchDB',
      url: `https://switchdb.org/game/${titleId}`,
      type: 'html'
    },
    // Nintendo API (direct)
    {
      name: 'Nintendo API Content',
      url: `https://api.ec.nintendo.com/v1/price?country=US&lang=en&ids=${nsuid}`,
      type: 'json'
    },
    // Alternate Nintendo store
    {
      name: 'Nintendo Store',
      url: `https://www.nintendo.com/store/products/mario-party-superstars-switch/`,
      type: 'html'
    }
  ];

  for (const source of sources) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${source.name}`);
    console.log(`URL: ${source.url}`);
    console.log('-'.repeat(60));

    try {
      const response = await fetch(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        if (source.type === 'json') {
          const data = await response.json();
          console.log('Response:', JSON.stringify(data, null, 2).slice(0, 500));
        } else if (source.type === 'image') {
          const buffer = await response.arrayBuffer();
          console.log(`✅ Image downloaded: ${buffer.byteLength} bytes`);
        } else if (source.type === 'html') {
          const html = await response.text();
          // Look for image URLs
          const imageMatches = html.match(/https:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi);
          if (imageMatches) {
            const unique = [...new Set(imageMatches)].slice(0, 3);
            console.log('Found images:');
            unique.forEach(url => console.log(`  - ${url}`));
          } else {
            console.log('No images found in HTML');
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
})();
