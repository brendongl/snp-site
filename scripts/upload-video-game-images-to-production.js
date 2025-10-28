/**
 * Upload Video Game Images to Production Volume
 *
 * This script uploads all video game images from local data/ directory
 * to the production environment's persistent volume.
 *
 * Usage:
 *   node scripts/upload-video-game-images-to-production.js
 */

const fs = require('fs');
const path = require('path');
const { FormData } = require('undici');

const PRODUCTION_URL = 'https://sipnplay.cafe';
const LOCAL_IMAGES_DIR = path.join(__dirname, '..', 'data', 'video-game-images', 'switch');

async function getAllImageFiles() {
  const files = fs.readdirSync(LOCAL_IMAGES_DIR);
  return files.filter(f => f.endsWith('.jpg'));
}

async function uploadImage(filePath, relativePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const uploadUrl = `${PRODUCTION_URL}/api/admin/upload-volume-file`;

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), path.basename(relativePath));
  formData.append('path', `video-game-images/switch/${path.basename(relativePath)}`);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData
  });

  return response.ok;
}

async function uploadAllImages() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📤 Upload Video Game Images to Production');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Source: ${LOCAL_IMAGES_DIR}`);
  console.log(`   Target: ${PRODUCTION_URL}/data/video-game-images/switch/`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if local directory exists
  if (!fs.existsSync(LOCAL_IMAGES_DIR)) {
    console.error('❌ Local images directory not found!');
    console.error(`   Expected: ${LOCAL_IMAGES_DIR}\n`);
    process.exit(1);
  }

  const imageFiles = await getAllImageFiles();
  console.log(`📊 Found ${imageFiles.length} image files locally\n`);

  if (imageFiles.length === 0) {
    console.error('❌ No image files found to upload!\n');
    process.exit(1);
  }

  // Instead of uploading one-by-one, we'll use a batch approach
  // Create a tarball and upload it
  console.log('💡 Alternative approach: Using image migration endpoint...\n');

  // Check if there's an upload endpoint
  const checkUrl = `${PRODUCTION_URL}/api/admin/migrate-images`;
  console.log(`🔍 Checking for migration endpoint: ${checkUrl}\n`);

  try {
    const response = await fetch(checkUrl);
    if (response.ok) {
      const info = await response.json();
      console.log('ℹ️  Migration endpoint exists:', info);
      console.log('\n⚠️  However, this endpoint migrates FROM Airtable, not from local files.');
      console.log('⚠️  We need a different approach...\n');
    }
  } catch (e) {
    // Endpoint might not exist
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 Recommendation:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Since production does not have video game images, and the images');
  console.log('only exist in git (not on any persistent volume), we have 2 options:');
  console.log('');
  console.log('Option 1: Modify Dockerfile to copy data/ directory on build');
  console.log('  - Add: COPY --from=builder /app/data ./data');
  console.log('  - This deploys git images to container on every build');
  console.log('  - Simpler, but increases image size');
  console.log('');
  console.log('Option 2: Create upload endpoint + upload script');
  console.log('  - Create: POST /api/admin/upload-file endpoint');
  console.log('  - Upload 1113 images via API (slow, but one-time)');
  console.log('  - More complex, but smaller container images');
  console.log('');
  console.log('Recommended: Option 1 (modify Dockerfile)');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

uploadAllImages();
