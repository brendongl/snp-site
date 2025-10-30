# Video Game Screenshots Solution

## Overview

This document describes the solution for including video game screenshots in the website and deploying them to Railway via Docker.

**Date**: October 30, 2025
**Status**: ✅ Ready for deployment

---

## Problem Statement

- **Local screenshots exist**: 369 screenshot files in `data/video-game-images/switch/`
- **Not in production**: Screenshots weren't included in Docker image or Railway persistent volume
- **Database URLs**: Some games had external screenshot URLs, others had none
- **Goal**: Include all local screenshots in Docker image so they deploy to Railway automatically

---

## Current State

### Local Files (as of Oct 30, 2025)
```
data/video-game-images/switch/
├── Landscape images:  371 files (*_landscape.jpg)
├── Portrait images:   371 files (*_portrait.jpg)
└── Screenshot images: 369 files (*_screenshot.jpg)
Total: 1,111 image files
```

### Image Types
1. **Landscape (16:9)** - Hero/banner images for game headers
2. **Portrait (1:1)** - Box art/card view images
3. **Screenshot** - In-game gameplay screenshots

---

## Solution Implemented

### 1. Modified `.dockerignore`

**Changed**: Removed `data/video-game-images/` from ignore list

```diff
# Exclude large data directories from Docker image
# These should be stored on persistent volumes or uploaded separately
- data/video-game-images/
+ # NOTE: data/video-game-images/ is now INCLUDED in Docker image (removed from ignore)
data/staff-ids/
data/images/
```

**Location**: `.dockerignore:60`

---

### 2. Modified `Dockerfile`

**Added**: COPY command to include video game images in production image

```dockerfile
# Copy video game images into the container
# These will be available at /app/data/video-game-images/switch/ in production
# Railway will mount persistent volume at /app/data for other data (images, staff-ids)
COPY --from=builder --chown=nextjs:nodejs /app/data/video-game-images ./data/video-game-images
```

**Location**: `Dockerfile:73-76`

**Why this works**:
- Images are copied from the `builder` stage into the final `runner` stage
- They're owned by `nextjs:nodejs` user for proper permissions
- Path matches the API endpoint: `/api/video-games/cached-images/[filename]`
- On Railway, the persistent volume mounts at `/app/data` but doesn't override this subdirectory

---

### 3. Created Analysis Script

**Script**: `scripts/analyze-screenshot-coverage.js`

**Purpose**: Analyze which games have screenshots locally vs in database

**Usage**:
```bash
node scripts/analyze-screenshot-coverage.js
```

**Output**: Shows coverage stats, gaps, and recommendations

---

### 4. Created URL Update Script

**Script**: `scripts/update-screenshot-urls-to-local.js`

**Purpose**: Update database to point to local screenshot files

**Usage**:
```bash
# After deployment, run this to update DB URLs
node scripts/update-screenshot-urls-to-local.js
```

**What it does**:
- Scans `data/video-game-images/switch/` for all image files
- Updates database records to use `/api/video-games/cached-images/{filename}` format
- Updates screenshot, landscape, and portrait URLs for matching games
- Only updates games that have corresponding local files

---

## API Endpoint

**Route**: `/api/video-games/cached-images/[filename]`

**Location**: `app/api/video-games/cached-images/[filename]/route.ts`

**How it works**:
1. Request: `GET /api/video-games/cached-images/0100000000010000_screenshot.jpg`
2. Server reads from: `/app/data/video-game-images/switch/0100000000010000_screenshot.jpg`
3. Returns image with proper caching headers

**Image path structure**:
```
{gameId}_screenshot.jpg   # In-game screenshot
{gameId}_landscape.jpg     # 16:9 hero image
{gameId}_portrait.jpg      # 1:1 box art
```

Example:
- Game ID: `0100000000010000`
- Screenshot: `/api/video-games/cached-images/0100000000010000_screenshot.jpg`
- Landscape: `/api/video-games/cached-images/0100000000010000_landscape.jpg`
- Portrait: `/api/video-games/cached-images/0100000000010000_portrait.jpg`

---

## Deployment Steps

### Step 1: Commit Changes
```bash
# From the worktree (already done in feature branch)
cd .worktrees/video-game-filters
git add Dockerfile .dockerignore scripts/
git commit -m "v1.18.0 - Include video game screenshots in Docker image

- Modified .dockerignore to allow data/video-game-images/
- Updated Dockerfile to COPY video game images into container
- Created scripts/analyze-screenshot-coverage.js
- Created scripts/update-screenshot-urls-to-local.js
- Images now deploy automatically to Railway

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 2: Push to Staging
```bash
git push origin feature/video-game-filters:staging
```

### Step 3: Railway Auto-Deploys
- GitHub Actions builds Docker image
- Railway detects push to `staging` branch
- Deploys new image with screenshots included

### Step 4: Update Database URLs (One-time)
```bash
# SSH into Railway container or run locally with production DATABASE_URL
node scripts/update-screenshot-urls-to-local.js
```

### Step 5: Test on Staging
- Visit staging URL
- Check video game modals show screenshots
- Verify API endpoint: `/api/video-games/cached-images/[filename]`

### Step 6: Deploy to Production
```bash
# After user confirms staging works
git push origin staging:main
```

---

## Missing Screenshots

### Current Coverage
- **369 games** have screenshots locally
- **371 games** have landscape/portrait images
- **2 games** are missing screenshots (have other images but no screenshot)

### Finding Missing Screenshots

**Option 1: Nintendo titledb (Automated)**
```bash
node scripts/backfill-missing-screenshots.js
```
- Downloads from: `https://raw.githubusercontent.com/blawar/titledb/master/US.en.json`
- Saves to: `data/video-game-images/switch/{gameId}_screenshot.jpg`
- Updates database with screenshot URLs

**Option 2: Manual Search (For games not in titledb)**
1. Google search: `"{game name}" switch screenshot gameplay`
2. Download high-quality screenshot (1280x720 or higher)
3. Save as: `data/video-game-images/switch/{gameId}_screenshot.jpg`
4. Run: `node scripts/update-screenshot-urls-to-local.js`

---

## Docker Image Size Impact

**Before**: ~500 MB (no video game images)
**After**: ~750 MB (with 369 screenshots + 742 landscape/portrait images)
**Increase**: ~250 MB

**Trade-offs**:
- ✅ **Pros**: Images deploy automatically, no separate upload needed
- ✅ **Pros**: Faster page loads (images served from container, not external URLs)
- ✅ **Pros**: Offline-capable (images don't depend on external services)
- ❌ **Cons**: Larger Docker image size
- ❌ **Cons**: Longer build times (~30 seconds extra)

**Verdict**: Worth it! 250MB is acceptable for 1,111 images that don't change often.

---

## File Locations

| File | Purpose | Lines Changed |
|------|---------|---------------|
| `.dockerignore` | Allow video-game-images | Line 60 |
| `Dockerfile` | Copy images to container | Lines 73-76 |
| `scripts/analyze-screenshot-coverage.js` | Analysis tool | New file |
| `scripts/update-screenshot-urls-to-local.js` | DB sync tool | New file |
| `app/api/video-games/cached-images/[filename]/route.ts` | Image serving | Existing |

---

## Testing

### Local Testing
```bash
# Build Docker image locally
docker build -t snp-site:test .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="your_db_url" \
  -e AIRTABLE_API_KEY="your_key" \
  snp-site:test

# Test image endpoint
curl http://localhost:3000/api/video-games/cached-images/0100000000010000_screenshot.jpg
```

### Production Testing
1. Visit game modal: `/video-games`
2. Click any game card
3. Check for screenshot (removed from modal but API should work)
4. Verify API: `/api/video-games/cached-images/{gameId}_screenshot.jpg`

---

## Rollback Plan

If issues occur:

1. **Revert Dockerfile changes**:
```bash
git revert HEAD
git push origin staging
```

2. **Remove images from container** (emergency):
```bash
# In Dockerfile, remove line:
COPY --from=builder --chown=nextjs:nodejs /app/data/video-game-images ./data/video-game-images
```

3. **Restore .dockerignore**:
```bash
# Add back to .dockerignore:
data/video-game-images/
```

---

## Future Improvements

### 1. Automated Screenshot Download
Create cron job to check titledb weekly for new games:
```bash
# Weekly on Sunday at 2am
0 2 * * 0 node scripts/backfill-missing-screenshots.js
```

### 2. Image Optimization
Compress screenshots before including in Docker:
```bash
# Use sharp or imagemagick to optimize
find data/video-game-images/switch/ -name "*_screenshot.jpg" -exec \
  mogrify -quality 85 -strip {} \;
```

### 3. CDN Integration
Consider moving to Cloudflare Images or Railway's CDN for:
- Automatic image resizing
- WebP conversion
- Better caching
- Reduce Docker image size

---

## References

- **Original script**: `scripts/upload-video-game-images-to-production.js`
- **Backfill script**: `scripts/backfill-missing-screenshots.js`
- **API endpoint**: `app/api/video-games/cached-images/[filename]/route.ts`
- **Docker docs**: [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- **titledb source**: https://github.com/blawar/titledb

---

## Changelog

### v1.18.0 (October 30, 2025)
- ✅ Modified `.dockerignore` to include `data/video-game-images/`
- ✅ Updated `Dockerfile` to copy images into production container
- ✅ Created `scripts/analyze-screenshot-coverage.js`
- ✅ Created `scripts/update-screenshot-urls-to-local.js`
- ✅ Documented solution in `docs/VIDEO_GAME_SCREENSHOTS_SOLUTION.md`
- 📊 Impact: +250MB Docker image, 369 screenshots now available

---

## Summary

**What changed**:
1. Docker image now includes 1,111 local image files (landscapes, portraits, screenshots)
2. Images are accessible via `/api/video-games/cached-images/[filename]` endpoint
3. Database can be updated to point to local files instead of external URLs

**Benefits**:
- Faster image loading (served from container)
- No dependency on external image services
- Automatic deployment (images included in Docker build)
- Offline-capable

**Next steps**:
1. Deploy to staging
2. Run `update-screenshot-urls-to-local.js` to sync database
3. Test thoroughly
4. Deploy to production
5. Find/download 2 missing screenshots (optional)
