/**
 * Simple test - Fetch API and check image URLs
 */

const STAGING_URL = 'https://staging-production-c398.up.railway.app';
const TEST_GAMES = [
  'Art of Balance',
  'Baldur\'s Gate: Dark Alliance',
  'Bubble Bobble 4 Friends: The Baron is Back!',
  'Castle Crashers Remastered',
  'Baba Is You',
  'Death Squared'
];

async function testImageURLs() {
  console.log('🎮 Testing Video Game Image URLs\n');
  console.log(`Fetching from: ${STAGING_URL}/api/video-games\n`);

  try {
    const response = await fetch(`${STAGING_URL}/api/video-games`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const games = data.games || [];

    console.log(`Total games in API: ${games.length}\n`);
    console.log('Checking specific games:\n');

    let passCount = 0;
    let failCount = 0;

    for (const testName of TEST_GAMES) {
      const game = games.find(g => g.name === testName);

      if (!game) {
        console.log(`   ✗ ${testName} - Not found in API`);
        failCount++;
        continue;
      }

      const hasLandscape = !!game.image_landscape_url;
      const hasPortrait = !!game.image_portrait_url;
      const hasScreenshot = !!game.image_screenshot_url;
      const hasAll = hasLandscape && hasPortrait && hasScreenshot;

      if (hasAll) {
        console.log(`   ✓ ${testName}`);
        console.log(`     Landscape: ${game.image_landscape_url.substring(0, 60)}...`);
        console.log(`     Portrait: ${game.image_portrait_url.substring(0, 60)}...`);
        console.log(`     Screenshot: ${game.image_screenshot_url.substring(0, 60)}...`);
        passCount++;
      } else {
        console.log(`   ✗ ${testName} - Missing images`);
        console.log(`     Landscape: ${hasLandscape ? 'YES' : 'NO'}`);
        console.log(`     Portrait: ${hasPortrait ? 'YES' : 'NO'}`);
        console.log(`     Screenshot: ${hasScreenshot ? 'YES' : 'NO'}`);
        failCount++;
      }
      console.log('');
    }

    // Check overall stats
    const gamesWithAllImages = games.filter(g =>
      g.image_landscape_url && g.image_portrait_url && g.image_screenshot_url
    );

    console.log('═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Test games checked: ${TEST_GAMES.length}`);
    console.log(`Passed: ${passCount} ✓`);
    console.log(`Failed: ${failCount} ✗`);
    console.log('');
    console.log(`Overall games with all 3 images: ${gamesWithAllImages.length}/${games.length} (${Math.round(gamesWithAllImages.length / games.length * 100)}%)`);
    console.log('═'.repeat(60));

    if (failCount > 0) {
      console.log('\n⚠️  Some games are missing images in the API!');
      process.exit(1);
    } else {
      console.log('\n🎉 All test games have complete image URLs!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

testImageURLs();
