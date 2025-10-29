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

  # Count how many images are in seed data
  SEED_COUNT=0
  if [ -d "/app/data-seed/video-game-images" ]; then
    SEED_COUNT=$(find "/app/data-seed/video-game-images" -type f 2>/dev/null | wc -l)
  fi

  echo "📦 Video game images in Docker image: $SEED_COUNT files"

  # Always copy images from seed to volume to ensure all images are available
  # This handles both initial deployment and updates with new images
  if [ "$SEED_COUNT" -gt 0 ]; then
    echo "🔄 Syncing video game images from Docker image to volume..."
    mkdir -p "$DATA_PATH/video-game-images"
    cp -rn /app/data-seed/video-game-images/* "$DATA_PATH/video-game-images/" 2>/dev/null || true
    NEW_COUNT=$(find "$DATA_PATH/video-game-images" -type f 2>/dev/null | wc -l)
    echo "✅ Video game images on volume: $NEW_COUNT files (synced from $SEED_COUNT seed files)"
  else
    echo "⚠️  No video game images in Docker image seed data"
    echo "   Images will show as broken until uploaded"
  fi

  # If no board game images on volume, copy from seed data
  IMAGE_COUNT=0
  if [ -d "$DATA_PATH/images" ]; then
    IMAGE_COUNT=$(find "$DATA_PATH/images" -type f 2>/dev/null | wc -l)
  fi

  if [ "$IMAGE_COUNT" -lt 500 ]; then
    echo "📦 Seeding board game images to volume..."
    if [ -d "/app/data-seed/images" ]; then
      mkdir -p "$DATA_PATH/images"
      cp -r /app/data-seed/images/* "$DATA_PATH/images/" 2>/dev/null || true
      NEW_IMAGE_COUNT=$(find "$DATA_PATH/images" -type f 2>/dev/null | wc -l)
      echo "✅ Seeded $NEW_IMAGE_COUNT board game images to volume"
    fi
  else
    echo "✅ Board game images ready: $IMAGE_COUNT files"
  fi

  # Create standard directories on volume
  mkdir -p "$DATA_PATH/images" "$DATA_PATH/video-game-images" "$DATA_PATH/logs"
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
