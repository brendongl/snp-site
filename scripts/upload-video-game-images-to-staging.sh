#!/bin/bash
# Upload video game images to Railway persistent volume (staging environment)
# This script uses Railway CLI to copy local images directly to the volume

set -e

echo "🚀 Video Game Images Upload to Railway (Staging)"
echo "=================================================="
echo ""

# Check if railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Count local images
LOCAL_IMAGE_COUNT=$(find data/video-game-images -type f -name "*.jpg" 2>/dev/null | wc -l)
echo "📊 Local images found: $LOCAL_IMAGE_COUNT files"

if [ "$LOCAL_IMAGE_COUNT" -eq 0 ]; then
    echo "❌ No images found in data/video-game-images/"
    exit 1
fi

# Create tar archive of images (for faster upload)
echo ""
echo "📦 Creating tar archive of images..."
tar -czf /tmp/video-game-images.tar.gz -C data video-game-images/
ARCHIVE_SIZE=$(du -h /tmp/video-game-images.tar.gz | cut -f1)
echo "✅ Archive created: $ARCHIVE_SIZE"

echo ""
echo "🔗 Linking to Railway staging environment..."
railway link

echo ""
echo "📤 Uploading images to persistent volume..."
echo "   This may take several minutes depending on your connection speed..."
echo ""

# Upload via Railway shell - extract directly on the volume
railway run bash -c "
    echo '📥 Receiving image archive...'
    cat > /tmp/video-game-images.tar.gz

    echo '📂 Extracting to persistent volume...'
    mkdir -p /app/data
    tar -xzf /tmp/video-game-images.tar.gz -C /app/data/

    echo '🧹 Cleaning up temporary files...'
    rm /tmp/video-game-images.tar.gz

    echo '✅ Verifying upload...'
    UPLOADED_COUNT=\$(find /app/data/video-game-images -type f -name '*.jpg' 2>/dev/null | wc -l)
    echo \"📊 Images on volume: \$UPLOADED_COUNT files\"

    if [ \"\$UPLOADED_COUNT\" -lt 1000 ]; then
        echo '⚠️  Warning: Expected at least 1000 images, got '\$UPLOADED_COUNT
        exit 1
    fi

    echo '✅ Upload successful!'
" < /tmp/video-game-images.tar.gz

# Clean up local archive
rm /tmp/video-game-images.tar.gz

echo ""
echo "✅ Video game images uploaded successfully to Railway!"
echo ""
echo "Next steps:"
echo "1. Verify images on staging: curl https://staging-production-c398.up.railway.app/api/admin/video-game-images"
echo "2. Update database URLs to point to /api/video-games/cached-images/[filename]"
echo "3. Test video games page"
