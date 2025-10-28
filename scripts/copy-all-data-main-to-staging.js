/**
 * Copy ALL data from Main (Production) to Staging
 *
 * This script copies the entire /data volume from production to staging,
 * including board game images, video game images, cache files, metadata, etc.
 *
 * Usage:
 *   node scripts/copy-all-data-main-to-staging.js
 *
 * What it does:
 * 1. Connects to staging environment
 * 2. Calls staging's API to fetch main's /data volume files
 * 3. Downloads and writes all files to staging's /data volume
 *
 * Note: This runs FROM staging, pulling data FROM main
 */

const MAIN_URL = 'https://sipnplay.cafe';
const STAGING_URL = 'https://staging-production-c398.up.railway.app';

async function copyAllDataFromMainToStaging() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 Copy ALL Data: Main → Staging');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Main (source):    ${MAIN_URL}`);
  console.log(`   Staging (target): ${STAGING_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Call staging's copy-volume endpoint, passing main's URL as the source
    const copyUrl = `${STAGING_URL}/api/admin/copy-volume?action=sync&staging_url=${encodeURIComponent(MAIN_URL)}`;

    console.log('🚀 Initiating copy operation...');
    console.log(`   POST ${copyUrl}\n`);

    const response = await fetch(copyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Copy Operation Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total files:     ${result.results.total}`);
    console.log(`   ✅ Success:      ${result.results.success}`);
    console.log(`   ⊘ Skipped:       ${result.results.skipped}`);
    console.log(`   ❌ Failed:       ${result.results.failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.results.errors && result.results.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      result.results.errors.slice(0, 10).forEach(err => {
        console.log(`   - ${err}`);
      });
      if (result.results.errors.length > 10) {
        console.log(`   ... and ${result.results.errors.length - 10} more errors`);
      }
      console.log('');
    }

    if (result.results.success > 0) {
      console.log('✅ Data copy completed successfully!');
      console.log(`   ${result.results.success} files copied to staging volume\n`);
    } else {
      console.log('❌ No files were copied. Check errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during copy operation:');
    console.error(`   ${error.message}\n`);
    process.exit(1);
  }
}

// Verify first that we can reach both environments
async function verifyEnvironments() {
  console.log('🔍 Verifying environments are reachable...\n');

  // Check main
  try {
    const mainResponse = await fetch(`${MAIN_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (mainResponse.ok) {
      console.log(`   ✅ Main accessible: ${MAIN_URL}`);
    } else {
      console.log(`   ⚠️  Main responded but unhealthy: ${mainResponse.status}`);
    }
  } catch (error) {
    console.error(`   ❌ Cannot reach main: ${error.message}`);
    throw new Error('Main environment unreachable');
  }

  // Check staging
  try {
    const stagingResponse = await fetch(`${STAGING_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (stagingResponse.ok) {
      console.log(`   ✅ Staging accessible: ${STAGING_URL}\n`);
    } else {
      console.log(`   ⚠️  Staging responded but unhealthy: ${stagingResponse.status}\n`);
    }
  } catch (error) {
    console.error(`   ❌ Cannot reach staging: ${error.message}`);
    throw new Error('Staging environment unreachable');
  }
}

// Main execution
(async () => {
  try {
    await verifyEnvironments();
    await copyAllDataFromMainToStaging();
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
})();
