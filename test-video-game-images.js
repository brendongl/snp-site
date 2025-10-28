/**
 * Test Video Game Images on Staging
 *
 * Verifies that specific games have all 3 images loaded correctly.
 */

const { chromium } = require('playwright');

const STAGING_URL = 'https://staging-production-c398.up.railway.app';
const TEST_GAMES = [
  'Art of Balance',
  'Baldur\'s Gate: Dark Alliance',
  'Bubble Bobble 4 Friends: The Baron is Back!',
  'Castle Crashers Remastered',
  'Baba Is You',
  'Death Squared'
];

async function testVideoGameImages() {
  console.log('🎮 Testing Video Game Images on Staging\n');
  console.log(`URL: ${STAGING_URL}/video-games\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigate to video games page
    console.log('1. Navigating to video games page...');
    await page.goto(`${STAGING_URL}/video-games`, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   ✓ Page loaded\n');

    // Wait for games to load
    console.log('2. Waiting for games to load...');
    await page.waitForSelector('[data-testid="video-game-card"], .video-game-card, img[alt*="cover"], img[alt*="game"]', { timeout: 10000 });
    console.log('   ✓ Games loaded\n');

    // Get all game cards
    const gameCards = await page.$$('img[alt]');
    console.log(`3. Found ${gameCards.length} images on page\n`);

    // Check specific games
    console.log('4. Checking specific games:\n');

    let passCount = 0;
    let failCount = 0;

    for (const gameName of TEST_GAMES) {
      // Search for the game
      const searchInput = await page.$('input[placeholder*="Search"], input[type="text"]');
      if (searchInput) {
        await searchInput.fill('');
        await searchInput.fill(gameName);
        await page.waitForTimeout(1000); // Wait for filter
      }

      // Check if game has image
      const gameImage = await page.$(`img[alt*="${gameName}"]`);

      if (gameImage) {
        const src = await gameImage.getAttribute('src');
        const naturalWidth = await gameImage.evaluate(img => img.naturalWidth);
        const naturalHeight = await gameImage.evaluate(img => img.naturalHeight);

        if (naturalWidth > 0 && naturalHeight > 0 && src && !src.includes('placeholder')) {
          console.log(`   ✓ ${gameName}`);
          console.log(`     Image: ${src.substring(0, 60)}...`);
          console.log(`     Size: ${naturalWidth}x${naturalHeight}`);
          passCount++;
        } else {
          console.log(`   ✗ ${gameName} - Image failed to load`);
          console.log(`     Src: ${src}`);
          console.log(`     Size: ${naturalWidth}x${naturalHeight}`);
          failCount++;
        }
      } else {
        console.log(`   ✗ ${gameName} - Game not found or no image`);
        failCount++;
      }
      console.log('');
    }

    // Summary
    console.log('═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total tested: ${TEST_GAMES.length}`);
    console.log(`Passed: ${passCount} ✓`);
    console.log(`Failed: ${failCount} ✗`);
    console.log(`Success rate: ${Math.round(passCount / TEST_GAMES.length * 100)}%`);
    console.log('═'.repeat(60));

    if (failCount > 0) {
      console.log('\n⚠️  Some games are missing images!');
      process.exit(1);
    } else {
      console.log('\n🎉 All games have images loaded!');
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

testVideoGameImages().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
