# Next Steps: Fix Video Game Image URLs

**Status**: Images uploaded successfully to Railway, but database URLs don't match actual filenames.

## Problem Summary

1. ✅ **1,391 images uploaded** to `/app/data/video-game-images/` on Railway
2. ❌ **Database URLs are wrong** - they point to non-existent filenames
3. ✅ **Serving endpoint works** - tested and confirmed images load when correct filename is used

## Root Cause

Images were downloaded and named using **MD5 hash of the image file content**:
```javascript
// From scripts/download-all-video-game-images.js line 79-80
function generateHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}
```

But we updated the database URLs using **MD5 hash of the Nintendo CDN URL**:
```javascript
// What we did (WRONG):
const hash = md5Hash(game.image_landscape_url);  // Hash of URL
updates.image_landscape_url = `/api/video-games/cached-images/${hash}.jpg`;
```

**Result**: Database points to `303289651ecc27ed01786f412a249c9c.jpg` but actual file is named something like `000ddfb811c1555dd8965873577c15d8.jpg`

## Verified Working

- ✅ Endpoint `/api/video-games/cached-images/000ddfb811c1555dd8965873577c15d8.jpg` returns image successfully
- ✅ 1,391 files exist on Railway volume
- ✅ Images are properly cached and accessible

## Solution Options

### Option 1: Re-download Images with URL-based Hashing (RECOMMENDED)

**Pros:**
- Clean, predictable mapping from database URLs to filenames
- No need to maintain separate mapping file
- Matches our update script logic

**Cons:**
- Need to download 1,390 images again (~770MB)
- Takes about 30 minutes

**Steps:**
1. Modify `scripts/download-all-video-game-images.js`:
   - Change line 79-80 to hash the **URL** instead of content:
     ```javascript
     function generateHash(url) {
       return crypto.createHash('md5').update(url).digest('hex');
     }
     ```
   - Update `processGameImages()` to pass URL to `generateHash()` instead of buffer
2. Run the download script to re-download all images with new naming
3. Upload new images to Railway (overwrite existing)
4. Database URLs are already updated correctly (from v1.12.12)
5. Test that images load on `/video-games` page

### Option 2: Create URL-to-ContentHash Mapping File

**Pros:**
- Don't need to re-download images
- Keeps content-based deduplication

**Cons:**
- Complex mapping logic needed
- Need to maintain mapping file
- Requires knowing original Nintendo URLs that were used for downloads

**Steps:**
1. Find or recreate the original Nintendo URLs used for downloads
2. For each game, download image temporarily, hash content, match to existing files
3. Build mapping: `{ "nintendo-url-hash": "content-hash" }`
4. Update serving endpoint to use mapping
5. Update database URLs to use mapping

### Option 3: Revert Database + Use Content-Hash Directly

**Pros:**
- Don't need to re-download
- Uses existing working images

**Cons:**
- Need to query volume to get actual filenames
- Complex lookup logic
- Database URLs won't be human-readable

**Steps:**
1. Get list of all 1,391 filenames from volume
2. For each game, try to match images by downloading and hashing
3. Update database with actual content-hash filenames
4. Very time-consuming and complex

## Recommendation: Option 1

**Re-download images with URL-based hashing**

This is the cleanest solution because:
- Database URLs are already correct for URL-based hashing
- Simple, predictable one-to-one mapping
- No complex logic or mapping files needed
- 30 minutes of download time is acceptable

## Implementation for Option 1

### 1. Update Download Script

Edit `scripts/download-all-video-game-images.js`:

```javascript
// OLD (line 79-80):
function generateHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// NEW:
function generateHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Then in processGameImages(), change:
// OLD:
const hash = generateHash(buffer);

// NEW:
const hash = generateHash(url);  // Use the URL, not the buffer
```

### 2. Run Download Locally

```bash
node scripts/download-all-video-game-images.js
```

This will:
- Download all 1,390 images from Nintendo CDN
- Save them with URL-based MD5 hashes
- Take approximately 30 minutes

### 3. Upload to Railway

```bash
node scripts/upload-images-via-http.js --url=https://staging-production-c398.up.railway.app --concurrent=10
```

### 4. Verify

```bash
# Check a sample image loads
curl -I "https://staging-production-c398.up.railway.app/api/video-games/cached-images/303289651ecc27ed01786f412a249c9c.jpg"

# Should return 200 OK with image/jpeg content-type
```

### 5. Test Frontend

Visit https://staging-production-c398.up.railway.app/video-games and verify all images load correctly.

## Current State

- Database: ✅ Updated with URL-based hash paths (v1.12.12)
- Images: ❌ Named with content-based hashes (mismatch)
- Serving: ✅ Endpoint works for correct filenames

## Files Modified So Far

- `lib/version.ts` - Updated to v1.12.13
- `package.json` - Updated to v1.12.13
- `app/api/admin/update-video-game-urls/route.ts` - Created (updates DB URLs)
- `app/api/video-games/cached-images/[filename]/route.ts` - Added debug logging
- `scripts/update-video-game-image-urls.js` - Created (local testing)
- `scripts/check-video-games-data.js` - Created (verification)

## What NOT to Do

❌ **DO NOT use Nintendo CDN URLs** - They return 404 errors
❌ **DO NOT leave database as-is** - URLs don't match actual files
❌ **DO NOT try complex mapping** - Overcomplicates the solution

## Time Estimate

- Modify download script: 5 minutes
- Run download locally: 30 minutes
- Upload to Railway: 2 minutes
- Test and verify: 5 minutes
- **Total: ~45 minutes**

## Questions?

If anything is unclear or you want to discuss alternative approaches, we can review in the morning. The key insight is that we need filename consistency between the database URLs and the actual files on disk.
