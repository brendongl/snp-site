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

  # Sync video game images from Docker image seed to persistent volume
  SEED_PATH="/app/video-game-images-seed"
  if [ -d "$SEED_PATH" ]; then
    SEED_COUNT=$(find "$SEED_PATH" -type f 2>/dev/null | wc -l)
    echo "📦 Found $SEED_COUNT video game images in Docker image seed"

    if [ "$SEED_COUNT" -gt 0 ]; then
      echo "🔄 Syncing video game images to persistent volume (force overwrite)..."
      mkdir -p "$DATA_PATH/video-game-images"

      # Remove old subdirectory structure if it exists
      if [ -d "$DATA_PATH/video-game-images/switch" ]; then
        echo "   Removing old subdirectory structure..."
        rm -rf "$DATA_PATH/video-game-images/switch"
      fi

      # Copy images from switch subdirectory directly to volume root
      # This flattens the structure so API can find them at /video-game-images/*.jpg
      if [ -d "$SEED_PATH/switch" ]; then
        echo "   Copying from seed/switch/ to volume root..."
        cp -f "$SEED_PATH/switch"/* "$DATA_PATH/video-game-images/" 2>/dev/null || true
      else
        # Fallback: copy everything if no switch subdirectory
        echo "   Copying all files from seed..."
        cp -rf "$SEED_PATH"/* "$DATA_PATH/video-game-images/" 2>/dev/null || true
      fi

      SYNCED_COUNT=$(find "$DATA_PATH/video-game-images" -type f -maxdepth 1 2>/dev/null | wc -l)
      echo "✅ Synced $SYNCED_COUNT video game images to volume (root level)"
    fi
  else
    echo "⚠️  No video game image seed found in Docker image"
    echo "   Images will be fetched from Airtable/API and cached on volume"
  fi

  # Create standard directories on volume
  mkdir -p "$DATA_PATH/images" "$DATA_PATH/video-game-images" "$DATA_PATH/logs"
  chown -R pwuser:pwuser "$DATA_PATH"
else
  echo "📁 No volume mount, using local /app/data"
  mkdir -p /app/data/images /app/data/video-game-images /app/data/logs
  chown -R pwuser:pwuser /app/data
  echo "ℹ️  Images will be fetched and cached in /app/data on-demand"
fi

echo "✅ Volume setup complete, starting application as pwuser..."

# Switch to pwuser (from Playwright image) and start the application
exec gosu pwuser node server.js
