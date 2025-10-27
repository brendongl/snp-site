const titleId = '01006FE013472000';

(async () => {
  try {
    console.log('Testing Switch game image CDNs...\n');

    const cdns = [
      { name: 'Tinfoil Icon', url: `https://tinfoil.media/icons/${titleId}.jpg` },
      { name: 'Tinfoil Banner', url: `https://tinfoil.media/banners/${titleId}.jpg` },
      { name: 'SwitchBrew', url: `https://switchbrew.org/w/images/${titleId}.jpg` },
    ];

    for (const cdn of cdns) {
      console.log(`${cdn.name}: ${cdn.url}`);

      try {
        const response = await fetch(cdn.url);
        console.log(`  Status: ${response.status}`);

        if (response.ok) {
          const buffer = await response.arrayBuffer();
          console.log(`  ✅ Downloaded: ${buffer.byteLength} bytes`);
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
      console.log('');
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
})();
