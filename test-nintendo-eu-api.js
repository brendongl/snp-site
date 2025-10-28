const nsuid = '70010000042934';

(async () => {
  console.log('Testing Nintendo Europe Search API...\n');

  // Nintendo Europe uses an Apache Solr search API
  const searchUrl = `https://searching.nintendo-europe.com/en/select?q=*&fq=nsuid_txt:${nsuid}&wt=json`;

  console.log('URL:', searchUrl);

  try {
    const response = await fetch(searchUrl);
    console.log('Status:', response.status);

    if (response.ok) {
      const data = await response.json();

      if (data.response && data.response.docs && data.response.docs.length > 0) {
        const game = data.response.docs[0];

        console.log('\n✅ Game Found!');
        console.log('Title:', game.title);
        console.log('NSUID:', game.nsuid_txt);
        console.log('\nImage URLs:');
        console.log('- Image URL:', game.image_url || 'not found');
        console.log('- Hero Banner:', game.hero_banner_url || 'not found');
        console.log('- Screenshots:', game.screenshot_image_url_h2x1_s || 'not found');
        console.log('- Box Art:', game.gift_finder_carousel_image_url_s || 'not found');

        // List all image-related fields
        console.log('\nAll image fields:');
        Object.keys(game).filter(key => key.includes('image') || key.includes('url')).forEach(key => {
          if (game[key] && typeof game[key] === 'string' && game[key].startsWith('http')) {
            console.log(`  ${key}: ${game[key]}`);
          }
        });
      } else {
        console.log('No results found');
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
})();
