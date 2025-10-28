/**
 * Trigger Video Game Image Seeding on Railway Environments
 *
 * This script calls the seed endpoint to copy 1111 images from
 * the container's data-seed directory to the persistent volume.
 *
 * Usage:
 *   node scripts/seed-video-game-images.js staging
 *   node scripts/seed-video-game-images.js main
 *   node scripts/seed-video-game-images.js both
 */

const STAGING_URL = 'https://staging-production-c398.up.railway.app';
const MAIN_URL = 'https://sipnplay.cafe';

async function triggerSeed(envName, baseUrl) {
  console.log(`\n🌱 Seeding ${envName}...`);
  console.log(`   URL: ${baseUrl}/api/admin/seed-video-game-images\n`);

  try {
    const response = await fetch(`${baseUrl}/api/admin/seed-video-game-images`, {
      method: 'POST'
    });

    if (!response.ok) {
      const text = await response.text();
      if (text.includes('404')) {
        console.log(`   ⚠️  Endpoint not deployed yet (404)`);
        console.log(`   Wait for deployment to complete and try again\n`);
        return false;
      }
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
    }

    const result = await response.json();

    if (result.skipped) {
      console.log(`   ✅ Already seeded: ${result.targetFileCount} files\n`);
      return true;
    }

    console.log(`   ✅ Seed completed!`);
    console.log(`   Files copied: ${result.copiedFileCount}`);
    console.log(`   Duration: ${result.durationMs}ms\n`);
    return true;

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const env = process.argv[2] || 'both';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌱 Video Game Image Seeding Tool');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let stagingOk = true;
  let mainOk = true;

  if (env === 'staging' || env === 'both') {
    stagingOk = await triggerSeed('STAGING', STAGING_URL);
  }

  if (env === 'main' || env === 'both') {
    mainOk = await triggerSeed('MAIN', MAIN_URL);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (env === 'staging' || env === 'both') {
    console.log(`   Staging: ${stagingOk ? '✅ SUCCESS' : '❌ FAILED'}`);
  }
  if (env === 'main' || env === 'both') {
    console.log(`   Main: ${mainOk ? '✅ SUCCESS' : '❌ FAILED'}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!stagingOk || !mainOk) {
    process.exit(1);
  }
}

main();
