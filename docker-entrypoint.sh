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

  # If volume has fewer than 100 files, copy from seed (should have 1111)
  if [ "$FILE_COUNT" -lt 100 ]; then
    echo "📥 Copying video-game-images from seed to persistent volume..."
    if [ -d "/app/data-seed/video-game-images" ]; then
      echo "   Source: /app/data-seed/video-game-images"
      echo "   Target: $DATA_PATH/video-game-images"

      # Remove empty directory if it exists
      rm -rf "$DATA_PATH/video-game-images"

      # Copy all files from seed
      cp -rv /app/data-seed/video-game-images "$DATA_PATH/" 2>&1 | head -20

      if [ -d "$DATA_PATH/video-game-images" ]; then
        NEW_FILE_COUNT=$(find "$DATA_PATH/video-game-images" -type f | wc -l)
        echo "✅ Video game images copied: $NEW_FILE_COUNT files"
      else
        echo "❌ Failed to copy video game images"
      fi
    else
      echo "⚠️  No video-game-images found in /app/data-seed/"
      echo "   Listing /app/data-seed contents:"
      ls -la /app/data-seed/ || echo "   Directory doesn't exist"
    fi
  else
    echo "✅ Video game images already exist on volume: $FILE_COUNT files (skipping copy)"
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
