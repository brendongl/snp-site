#!/bin/sh
set -e

echo "🔧 Setting up persistent volume..."

# Check if persistent volume is mounted
if [ -n "$RAILWAY_VOLUME_MOUNT_PATH" ]; then
  echo "📦 Railway volume detected: $RAILWAY_VOLUME_MOUNT_PATH"

  # If volume is empty or missing video-game-images, copy from git
  if [ ! -d "$RAILWAY_VOLUME_MOUNT_PATH/video-game-images" ]; then
    echo "📥 Copying video-game-images from git to persistent volume..."
    if [ -d "/app/data/video-game-images" ]; then
      cp -r /app/data/video-game-images "$RAILWAY_VOLUME_MOUNT_PATH/"
      echo "✅ Video game images copied to volume"
    else
      echo "⚠️  No video-game-images found in git data/"
    fi
  else
    echo "✅ Video game images already exist on volume"
  fi

  # Create standard directories on volume
  mkdir -p "$RAILWAY_VOLUME_MOUNT_PATH/images" "$RAILWAY_VOLUME_MOUNT_PATH/logs"
  chown -R nextjs:nodejs "$RAILWAY_VOLUME_MOUNT_PATH"
else
  echo "📁 No volume mount, using local data directory"
  mkdir -p /app/data/images /app/data/video-game-images /app/logs
  chown -R nextjs:nodejs /app/data /app/logs
fi

echo "✅ Volume setup complete, starting application as nextjs user..."

# Switch to nextjs user and start the application
exec gosu nextjs node server.js
