/**
 * Check what files exist on main's /data volume
 */

const MAIN_URL = 'https://sipnplay.cafe';

async function checkMainFiles() {
  console.log('🔍 Checking files on MAIN environment...\n');

  try {
    const response = await fetch(`${MAIN_URL}/api/admin/staging-files?action=list`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`Total files on MAIN: ${data.total}\n`);

    const videoGameImages = data.files.filter(f => f.includes('video-game-images'));
    const boardGameImages = data.files.filter(f => f.startsWith('images/'));
    const cacheFiles = data.files.filter(f => f.includes('cache'));
    const logFiles = data.files.filter(f => f.includes('logs'));
    const other = data.files.filter(f =>
      !f.includes('video-game-images') &&
      !f.startsWith('images/') &&
      !f.includes('cache') &&
      !f.includes('logs')
    );

    console.log('File breakdown:');
    console.log(`  Video game images: ${videoGameImages.length}`);
    console.log(`  Board game images: ${boardGameImages.length}`);
    console.log(`  Cache files: ${cacheFiles.length}`);
    console.log(`  Log files: ${logFiles.length}`);
    console.log(`  Other files: ${other.length}\n`);

    if (videoGameImages.length > 0) {
      console.log('✅ Video game images found on main!');
      console.log('\nSample video game images:');
      videoGameImages.slice(0, 10).forEach(f => console.log(`  - ${f}`));
    } else {
      console.log('❌ No video game images found on main!');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMainFiles();
