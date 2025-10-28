const https = require('https');

https.get('https://staging-production-c398.up.railway.app/api/debug/filesystem', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    console.log('\n📊 Filesystem Status\n');
    console.log('Deployment timestamp:', parsed.timestamp);
    console.log('Environment:', parsed.environment.RAILWAY_VOLUME_MOUNT_PATH);
    console.log('');

    parsed.checks.forEach(c => {
      console.log(`${c.path}:`);
      if (c.fileCount !== undefined) console.log(`  Files: ${c.fileCount}`);
      if (c.exists !== undefined) console.log(`  Exists: ${c.exists}`);
      console.log('');
    });

    const volumeImages = parsed.checks.find(c => c.path === '/app/data/video-game-images');
    if (volumeImages && volumeImages.fileCount > 1000) {
      console.log('✅ SUCCESS! Images are deployed!\n');
    } else {
      console.log('❌ Images not deployed yet. Container may need restart.\n');
    }
  });
}).on('error', err => console.error('Error:', err.message));
