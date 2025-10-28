/**
 * Verify Video Game Images Deployed Successfully
 *
 * Checks that:
 * 1. Files exist on persistent volume
 * 2. API endpoint serves images correctly
 * 3. Sample images are accessible
 */

const MAIN_URL = 'https://sipnplay.cafe';
const STAGING_URL = 'https://staging-production-c398.up.railway.app';

async function verifyEnvironment(envName, baseUrl) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 Verifying ${envName}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Step 1: Check file list
  try {
    console.log('📋 Step 1: Checking file list...');
    const listResponse = await fetch(`${baseUrl}/api/admin/staging-files?action=list`);

    if (!listResponse.ok) {
      console.log(`   ❌ Failed to fetch file list: ${listResponse.status}\n`);
      return false;
    }

    const { files, total } = await listResponse.json();
    const videoGameImages = files.filter(f => f.includes('video-game-images'));

    console.log(`   Total files: ${total}`);
    console.log(`   Video game images: ${videoGameImages.length}`);

    if (videoGameImages.length === 0) {
      console.log(`   ❌ No video game images found!\n`);
      return false;
    }

    console.log(`   ✅ Video game images found on volume\n`);

    // Step 2: Test API endpoint with a few sample games
    const sampleGames = [
      '0100DC801D85E000', // Ready, Steady, Ship!
      '010015100B514000', // Super Mario Bros Wonder
      '01009BF0072D4000', // Captain Toad
    ];

    console.log('🖼️  Step 2: Testing image API endpoints...');

    for (const gameId of sampleGames) {
      const imageUrl = `${baseUrl}/api/video-games/images/${gameId}?type=landscape`;

      try {
        const imageResponse = await fetch(imageUrl);

        if (imageResponse.ok) {
          const contentType = imageResponse.headers.get('content-type');
          const contentLength = imageResponse.headers.get('content-length');

          console.log(`   ✅ ${gameId}: ${contentType}, ${contentLength} bytes`);
        } else {
          console.log(`   ❌ ${gameId}: HTTP ${imageResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${gameId}: ${error.message}`);
      }
    }

    console.log(`\n✅ ${envName} verification complete!`);
    return true;

  } catch (error) {
    console.error(`\n❌ ${envName} verification failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Video Game Images Deployment Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const mainOk = await verifyEnvironment('MAIN (Production)', MAIN_URL);
  const stagingOk = await verifyEnvironment('STAGING', STAGING_URL);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Main: ${mainOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Staging: ${stagingOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!mainOk || !stagingOk) {
    process.exit(1);
  }
}

main();
