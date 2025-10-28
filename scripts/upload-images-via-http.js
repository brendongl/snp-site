/**
 * Upload Video Game Images to Railway via HTTP
 *
 * This script uploads local video game images to Railway's persistent volume
 * using the HTTP API endpoint. It uploads multiple images in parallel for speed.
 *
 * Usage:
 *   node scripts/upload-images-via-http.js [--url https://your-site.com] [--concurrent 10]
 */

const fs = require('fs');
const path = require('path');
const { FormData } = require('undici');

// Configuration
const LOCAL_IMAGES_DIR = path.join(__dirname, '..', 'data', 'video-game-images');
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const concurrentArg = args.find(arg => arg.startsWith('--concurrent='));

const BASE_URL = urlArg ? urlArg.split('=')[1] : 'https://staging-production-c398.up.railway.app';
const CONCURRENT_UPLOADS = concurrentArg ? parseInt(concurrentArg.split('=')[1]) : 10;
const UPLOAD_ENDPOINT = `${BASE_URL}/api/admin/upload-video-game-image`;

// Statistics
let uploaded = 0;
let failed = 0;
let skipped = 0;
const startTime = Date.now();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📤 Upload Video Game Images via HTTP');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   Source:      ${LOCAL_IMAGES_DIR}`);
console.log(`   Destination: ${BASE_URL}`);
console.log(`   Concurrent:  ${CONCURRENT_UPLOADS} uploads at a time`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all image files
console.log('📂 Scanning local images...');
const imageFiles = fs.readdirSync(LOCAL_IMAGES_DIR).filter(f => f.endsWith('.jpg'));
console.log(`✅ Found ${imageFiles.length} images\n`);

if (imageFiles.length === 0) {
  console.error('❌ No images found in local directory\n');
  process.exit(1);
}

/**
 * Upload a single image file
 */
async function uploadImage(filename) {
  const filePath = path.join(LOCAL_IMAGES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), filename);
  formData.append('filename', filename);

  try {
    const response = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    return { success: true, filename, size: result.size };
  } catch (error) {
    return { success: false, filename, error: error.message };
  }
}

/**
 * Upload images in batches with concurrency limit
 */
async function uploadInParallel(files, concurrency) {
  const total = files.length;
  const results = [];

  console.log('🚀 Starting upload...\n');

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(files.length / concurrency);

    console.log(`📦 Batch ${batchNumber}/${totalBatches} (${batch.length} images)`);

    const batchResults = await Promise.all(batch.map(uploadImage));

    for (const result of batchResults) {
      if (result.success) {
        uploaded++;
        process.stdout.write(`   ✅ ${result.filename} (${formatBytes(result.size)})\n`);
      } else {
        failed++;
        process.stdout.write(`   ❌ ${result.filename}: ${result.error}\n`);
      }
    }

    // Progress update
    const progress = Math.round(((i + batch.length) / total) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rate = ((i + batch.length) / elapsed).toFixed(1);
    const eta = Math.round((total - (i + batch.length)) / rate);

    console.log(`   Progress: ${i + batch.length}/${total} (${progress}%) | ${elapsed}s elapsed | ETA: ${eta}s\n`);

    results.push(...batchResults);
  }

  return results;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Main upload process
 */
async function main() {
  try {
    // Check if endpoint is accessible
    console.log('🔍 Checking upload endpoint...');
    const checkResponse = await fetch(UPLOAD_ENDPOINT);
    if (!checkResponse.ok) {
      console.error(`❌ Upload endpoint not accessible: HTTP ${checkResponse.status}`);
      console.error('   Make sure the latest version is deployed with the upload endpoint.\n');
      process.exit(1);
    }
    const status = await checkResponse.json();
    console.log(`✅ Endpoint ready. Current images: ${status.currentImages}\n`);

    // Upload all images
    const results = await uploadInParallel(imageFiles, CONCURRENT_UPLOADS);

    // Summary
    const duration = Math.round((Date.now() - startTime) / 1000);
    const totalSize = imageFiles.reduce((sum, f) => {
      const stats = fs.statSync(path.join(LOCAL_IMAGES_DIR, f));
      return sum + stats.size;
    }, 0);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Upload Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`   Total images: ${imageFiles.length}`);
    console.log(`   Uploaded:     ${uploaded} ✅`);
    console.log(`   Failed:       ${failed} ❌`);
    console.log(`   Total size:   ${formatBytes(totalSize)}`);
    console.log(`   Duration:     ${duration}s`);
    console.log(`   Rate:         ${(imageFiles.length / duration).toFixed(1)} images/sec`);
    console.log('');
    console.log('Next steps:');
    console.log(`1. Verify upload: curl ${BASE_URL}/api/admin/video-game-images`);
    console.log(`2. Test images:   ${BASE_URL}/video-games`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (failed > 0) {
      console.error(`⚠️  ${failed} images failed to upload. Check errors above.\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error(`1. Check if endpoint exists: curl ${UPLOAD_ENDPOINT}`);
    console.error('2. Verify Railway deployment is complete');
    console.error('3. Check Railway logs for errors\n');
    process.exit(1);
  }
}

main();
