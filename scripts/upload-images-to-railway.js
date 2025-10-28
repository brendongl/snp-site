/**
 * Upload Video Game Images to Railway Persistent Volume
 *
 * This script uploads local video game images to Railway's persistent volume
 * using the Railway CLI. It creates a tar archive and extracts it on the volume.
 *
 * Prerequisites:
 * - Railway CLI installed: npm install -g @railway/cli
 * - Logged in to Railway: railway login
 * - Project linked: railway link (or use --service flag)
 *
 * Usage:
 *   node scripts/upload-images-to-railway.js [--environment staging|production]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const LOCAL_IMAGES_DIR = path.join(__dirname, '..', 'data', 'video-game-images');
const TAR_FILE = path.join(__dirname, '..', 'video-game-images.tar.gz');
const RAILWAY_VOLUME_PATH = '/app/data/video-game-images';

// Parse command line arguments
const args = process.argv.slice(2);
const envFlag = args.find(arg => arg.startsWith('--environment='));
const environment = envFlag ? envFlag.split('=')[1] : 'staging';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📤 Upload Video Game Images to Railway');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   Environment: ${environment}`);
console.log(`   Source:      ${LOCAL_IMAGES_DIR}`);
console.log(`   Destination: ${RAILWAY_VOLUME_PATH}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Step 1: Check if Railway CLI is installed
console.log('🔍 Checking Railway CLI...');
try {
  const version = execSync('railway --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Railway CLI found: ${version}\n`);
} catch (error) {
  console.error('❌ Railway CLI not found!');
  console.error('   Install it with: npm install -g @railway/cli');
  console.error('   Then login with: railway login\n');
  process.exit(1);
}

// Step 2: Check if local images exist
console.log('📂 Checking local images...');
if (!fs.existsSync(LOCAL_IMAGES_DIR)) {
  console.error(`❌ Local images directory not found: ${LOCAL_IMAGES_DIR}\n`);
  process.exit(1);
}

const localFiles = fs.readdirSync(LOCAL_IMAGES_DIR).filter(f => f.endsWith('.jpg'));
console.log(`✅ Found ${localFiles.length} images (${formatBytes(getDirectorySize(LOCAL_IMAGES_DIR))})\n`);

if (localFiles.length === 0) {
  console.error('❌ No image files found in local directory\n');
  process.exit(1);
}

// Step 3: Create tar archive
console.log('📦 Creating compressed archive...');
try {
  // Remove old archive if exists
  if (fs.existsSync(TAR_FILE)) {
    fs.unlinkSync(TAR_FILE);
  }

  // Create tar.gz archive (cd into directory to avoid nested paths)
  execSync(`tar -czf "${TAR_FILE}" -C "${LOCAL_IMAGES_DIR}" .`, { stdio: 'inherit' });

  const archiveSize = fs.statSync(TAR_FILE).size;
  console.log(`✅ Archive created: ${formatBytes(archiveSize)}\n`);
} catch (error) {
  console.error('❌ Failed to create archive:', error.message);
  process.exit(1);
}

// Step 4: Upload and extract on Railway
console.log('🚀 Uploading to Railway...');
console.log('   This may take several minutes depending on your connection speed...\n');

try {
  // Build the railway command with environment
  const envArg = environment !== 'staging' ? ` --environment ${environment}` : '';

  // Upload and extract in Railway container
  const uploadCommand = `
    # Create directory on volume
    mkdir -p ${RAILWAY_VOLUME_PATH}

    # Extract archive (stdin contains the tar.gz data)
    tar -xzf - -C ${RAILWAY_VOLUME_PATH}

    # Count uploaded files
    UPLOADED_COUNT=$(find ${RAILWAY_VOLUME_PATH} -type f -name "*.jpg" 2>/dev/null | wc -l)
    echo ""
    echo "✅ Upload complete: $UPLOADED_COUNT images on volume"

    # Verify count matches expected
    if [ "$UPLOADED_COUNT" -lt 1000 ]; then
      echo "⚠️  Warning: Expected at least 1000 images, got $UPLOADED_COUNT"
      exit 1
    fi
  `.trim();

  // Execute via Railway (pipe tar file to stdin)
  execSync(`railway run${envArg} bash -c "${uploadCommand}" < "${TAR_FILE}"`, {
    stdio: 'inherit',
    maxBuffer: 1024 * 1024 * 100 // 100MB buffer
  });

  console.log('\n✅ Images uploaded successfully to Railway!\n');

} catch (error) {
  console.error('\n❌ Upload failed:', error.message);
  console.error('\nTroubleshooting:');
  console.error('1. Ensure you are logged in: railway login');
  console.error('2. Link to your project: railway link');
  console.error('3. Check Railway status: railway status');
  console.error('4. Verify volume is mounted: railway vars\n');
  process.exit(1);
} finally {
  // Clean up tar file
  if (fs.existsSync(TAR_FILE)) {
    fs.unlinkSync(TAR_FILE);
    console.log('🧹 Cleaned up temporary archive\n');
  }
}

// Step 5: Verify upload
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Upload Complete!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('Next steps:');
console.log('1. Verify upload via API:');
console.log('   curl https://staging-production-c398.up.railway.app/api/admin/video-game-images');
console.log('');
console.log('2. Update database URLs (if needed):');
console.log('   node scripts/update-video-game-urls-to-cdn.js');
console.log('');
console.log('3. Test video games page:');
console.log('   https://staging-production-c398.up.railway.app/video-games');
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Helper functions
function getDirectorySize(dirPath) {
  let size = 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      size += stats.size;
    } else if (stats.isDirectory()) {
      size += getDirectorySize(filePath);
    }
  }
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
