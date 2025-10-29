/**
 * Check Railway Volume Status
 * This script checks the status of images on the Railway persistent volume
 */

const fs = require('fs');
const path = require('path');

// Check both possible locations
const boardGamePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'images')
  : path.join(process.cwd(), 'data', 'images');

const videoGamePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'video-game-images')
  : path.join(process.cwd(), 'data', 'video-game-images');

console.log('🔍 Railway Volume Status Check');
console.log('================================\n');

console.log('Environment Variables:');
console.log('----------------------');
console.log(`RAILWAY_VOLUME_MOUNT_PATH: ${process.env.RAILWAY_VOLUME_MOUNT_PATH || 'not set (local dev)'}`);
console.log(`RAILWAY_ENVIRONMENT_NAME: ${process.env.RAILWAY_ENVIRONMENT_NAME || 'not set'}`);
console.log(`RAILWAY_SERVICE_NAME: ${process.env.RAILWAY_SERVICE_NAME || 'not set'}`);

console.log('\n📁 Board Game Images:');
console.log('---------------------');
console.log(`Path: ${boardGamePath}`);

if (fs.existsSync(boardGamePath)) {
  const files = fs.readdirSync(boardGamePath);
  const stats = fs.statSync(boardGamePath);

  console.log(`✅ Directory exists`);
  console.log(`   Total files: ${files.length}`);

  // Calculate total size
  let totalSize = 0;
  files.forEach(file => {
    const filePath = path.join(boardGamePath, file);
    const fileStats = fs.statSync(filePath);
    totalSize += fileStats.size;
  });

  console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  // Show sample files
  if (files.length > 0) {
    console.log(`   Sample files:`);
    files.slice(0, 5).forEach(file => {
      const filePath = path.join(boardGamePath, file);
      const fileStats = fs.statSync(filePath);
      console.log(`     - ${file} (${(fileStats.size / 1024).toFixed(2)} KB)`);
    });
  }
} else {
  console.log(`❌ Directory does not exist`);
}

console.log('\n🎮 Video Game Images:');
console.log('---------------------');
console.log(`Path: ${videoGamePath}`);

if (fs.existsSync(videoGamePath)) {
  const files = fs.readdirSync(videoGamePath);

  console.log(`✅ Directory exists`);
  console.log(`   Total files: ${files.length}`);

  // Calculate total size
  let totalSize = 0;
  files.forEach(file => {
    const filePath = path.join(videoGamePath, file);
    const fileStats = fs.statSync(filePath);
    totalSize += fileStats.size;
  });

  console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  // Show sample files
  if (files.length > 0) {
    console.log(`   Sample files:`);
    files.slice(0, 5).forEach(file => {
      const filePath = path.join(videoGamePath, file);
      const fileStats = fs.statSync(filePath);
      console.log(`     - ${file} (${(fileStats.size / 1024).toFixed(2)} KB)`);
    });
  }
} else {
  console.log(`❌ Directory does not exist`);
}

console.log('\n✅ Check complete');