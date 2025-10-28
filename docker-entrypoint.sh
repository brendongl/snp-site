#!/bin/sh
set -e

echo "🔧 Setting up persistent volume..."

# Check if persistent volume is mounted
if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
  echo "📦 Railway volume detected: $RAILWAY_VOLUME_MOUNT_PATH"

  # Ensure the volume mount path becomes /app/data (Railway convention)
  DATA_PATH="/app/data"

  echo "📂 Using data path: $DATA_PATH"

  # Check if video-game-images directory has any files
  FILE_COUNT=0
  if [ -d "$DATA_PATH/video-game-images" ]; then
    FILE_COUNT=$(find "$DATA_PATH/video-game-images" -type f 2>/dev/null | wc -l)
  fi

  echo "📊 Current video game images on volume: $FILE_COUNT files"

  # Expected minimum: ~1300 images (511 games × 3 images, with some deduplication)
  if [ "$FILE_COUNT" -lt 1000 ]; then
    echo "⚠️  Video game images need to be downloaded"
    echo "   Starting automatic image download..."

    # Run download script as nextjs user
    gosu nextjs node /app/scripts/download-all-video-game-images.js || true

    # Retry any failures
    echo "   Retrying failed downloads..."
    gosu nextjs node /app/scripts/retry-failed-nintendo-images.js || true

    # Recount files
    FILE_COUNT=$(find "$DATA_PATH/video-game-images" -type f 2>/dev/null | wc -l)
    echo "✅ Video game images downloaded: $FILE_COUNT files"
  else
    echo "✅ Video game images ready: $FILE_COUNT files"
  fi

  # Create standard directories on volume
  mkdir -p "$DATA_PATH/images" "$DATA_PATH/logs"
  chown -R nextjs:nodejs "$DATA_PATH"
else
  echo "📁 No volume mount, copying seed data to /app/data"
  mkdir -p /app/data

  if [ -d "/app/data-seed" ]; then
    cp -r /app/data-seed/* /app/data/
    echo "✅ Seed data copied"
  fi

  mkdir -p /app/data/images /app/data/logs
  chown -R nextjs:nodejs /app/data /app/logs
fi

echo "✅ Volume setup complete, starting application as nextjs user..."

# Switch to nextjs user and start the application
exec gosu nextjs node server.js
