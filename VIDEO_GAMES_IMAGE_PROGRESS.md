# Video Games Image Implementation Progress

**Last Updated**: 2025-01-27
**Current Status**: Images downloaded but not displaying on staging
**Version**: 1.9.1

---

## Current Problem

Images are **not displaying** on the staging environment despite:
- ✅ Successfully downloading 1113 image files (371 games × 3 types)
- ✅ Images saved to local `data/video-game-images/switch/` directory
- ✅ Database updated with image URL paths
- ✅ All files committed and pushed to staging branch
- ❌ Images still showing as placeholders/dark cards on staging

---

## What Has Been Done

### 1. Image Source Discovery ✅

**Working CDN Found**: Nintendo eShop CDN via Blawar's titledb
- URL: `https://raw.githubusercontent.com/blawar/titledb/master/US.en.json`
- CDN: `img-eshop.cdn.nintendo.net`
- Contains: `bannerUrl`, `iconUrl`, `screenshots[]` fields

**Tested and Failed**:
- Nintendo CDN (assets.nintendo.com) - requires slugs not NSUIDs
- Gaming APIs (RAWG, IGDB, GiantBomb, SteamGridDB) - all require API keys
- Community CDNs (Tinfoil, NSWDB, SwitchDB) - all 404
- DekuDeals scraping - JavaScript-rendered content

### 2. Image Download Script Created ✅

**File**: `scripts/download-images-from-titledb.js`

**What it does**:
1. Loads titledb JSON (31,549 games)
2. Queries PostgreSQL for all Switch games (511 total)
3. Matches games by NSUID
4. Downloads 3 image types per game:
   - **Landscape**: `bannerUrl` from titledb → 16:9 hero image
   - **Portrait**: `iconUrl` from titledb → square box art
   - **Screenshot**: First item from `screenshots[]` array
5. Saves to `data/video-game-images/switch/{titleId}_{type}.jpg`
6. Updates database with image URLs:
   - `image_landscape_url = /api/video-games/images/{id}?type=landscape`
   - `image_portrait_url = /api/video-games/images/{id}?type=portrait`
   - `image_screenshot_url = /api/video-games/images/{id}?type=screenshot`

**Results**:
```
📊 Download Summary
✅ Games with images: 371 (73%)
⚠️  Games without images: 140 (27%)
❌ Errors: 0
```

### 3. Files Modified/Created ✅

**Code Changes**:
- `scripts/download-images-from-titledb.js` - New download script
- `lib/version.ts` - Updated to 1.9.1
- `package.json` - Updated to 1.9.1

**Image Files**:
- `data/video-game-images/switch/` - 1113 JPG files
- Format: `{titleId}_landscape.jpg`, `{titleId}_portrait.jpg`, `{titleId}_screenshot.jpg`
- Example: `01006FE013472000_landscape.jpg` (Mario Party Superstars)

**Deployment**:
- Committed: 1119 files total
- Branch: staging
- Pushed: 2025-01-27
- Status: Deployed to Railway (build succeeded)

---

## What's NOT Working

### Issue: Images Don't Display on Staging

**Symptoms**:
- Most games show dark/black cards instead of images
- Some games show gradient placeholders (expected for 140 games without images)
- No actual Nintendo game images visible

**Possible Causes**:

1. **API Endpoint Not Serving Images**
   - File: `app/api/video-games/images/[id]/route.ts` (or similar)
   - Check if this endpoint exists and works correctly
   - Should read from `data/video-game-images/switch/` directory

2. **Persistent Volume Not Mounted on Railway**
   - Images downloaded locally to `data/video-game-images/switch/`
   - Railway may not have persistent volume configured
   - Images might not be accessible in Docker container

3. **Image Path Mismatch**
   - Database has URLs like `/api/video-games/images/{id}?type=landscape`
   - API endpoint may be looking in wrong directory
   - Path on Railway might differ from local path

4. **Database URLs Not Updated**
   - Script claimed to update database, but verify with query
   - Check if `image_landscape_url`, `image_portrait_url`, `image_screenshot_url` actually populated

5. **Railway Volume Not Persisting**
   - Images committed to git (1113 files)
   - But Railway might not be copying them to container
   - Large binary files in git might be ignored

---

## Next Steps to Debug

### Step 1: Verify Database Has URLs

```bash
export DATABASE_URL="postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway"

node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const client = await pool.connect();
  const result = await client.query(\`
    SELECT id, name, image_landscape_url, image_portrait_url, image_screenshot_url
    FROM video_games
    WHERE platform = 'switch'
    AND image_landscape_url IS NOT NULL
    LIMIT 5
  \`);
  console.log('Games with image URLs:', result.rows);
  client.release();
  await pool.end();
})();
"
```

Expected: Should see 371 games with image URLs like `/api/video-games/images/{id}?type=landscape`

### Step 2: Check if API Endpoint Exists

**Files to check**:
- `app/api/video-games/images/[id]/route.ts`
- `app/api/video-games/images/route.ts`

**What it should do**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'landscape'; // landscape, portrait, screenshot

  const imagePath = path.join(
    process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data'),
    'video-game-images',
    'switch',
    `${id}_${type}.jpg`
  );

  if (!fs.existsSync(imagePath)) {
    return new NextResponse('Image not found', { status: 404 });
  }

  const imageBuffer = fs.readFileSync(imagePath);
  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
```

### Step 3: Verify Images Exist on Railway Container

**SSH into Railway container** (if possible):
```bash
ls -la data/video-game-images/switch/ | head -20
# Should show files like 01006FE013472000_landscape.jpg
```

Or **add debug endpoint**:
```typescript
// app/api/debug/video-game-images/route.ts
export async function GET() {
  const fs = require('fs');
  const path = require('path');

  const basePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
  const imagesPath = path.join(basePath, 'video-game-images', 'switch');

  const exists = fs.existsSync(imagesPath);
  const files = exists ? fs.readdirSync(imagesPath).slice(0, 10) : [];

  return Response.json({
    basePath,
    imagesPath,
    exists,
    fileCount: exists ? fs.readdirSync(imagesPath).length : 0,
    sampleFiles: files
  });
}
```

Then visit: `https://staging-production-c398.up.railway.app/api/debug/video-game-images`

### Step 4: Check Railway Volume Configuration

**Files to check**:
- `railway.json` - Volume mount configuration
- `Dockerfile` - COPY commands for data directory

**Expected railway.json**:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Check if Dockerfile copies images**:
```dockerfile
# Should have something like:
COPY data ./data
# or
COPY data/video-game-images ./data/video-game-images
```

### Step 5: Alternative - Use Remote CDN Directly

**Instead of caching images locally**, update the database to use titledb URLs directly:

```javascript
// scripts/update-to-use-titledb-urls.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();

  // Load titledb
  const response = await fetch('https://raw.githubusercontent.com/blawar/titledb/master/US.en.json');
  const titledb = await response.json();

  // Get all games
  const result = await client.query(`
    SELECT id, platform_specific_data
    FROM video_games
    WHERE platform = 'switch'
  `);

  for (const game of result.rows) {
    const data = typeof game.platform_specific_data === 'string'
      ? JSON.parse(game.platform_specific_data)
      : game.platform_specific_data;

    const nsuid = data?.nsuid;
    if (!nsuid) continue;

    const titledbGame = titledb[nsuid];
    if (!titledbGame) continue;

    // Use titledb URLs directly (no caching)
    await client.query(`
      UPDATE video_games
      SET
        image_landscape_url = $1,
        image_portrait_url = $2,
        image_screenshot_url = $3,
        updated_at = NOW()
      WHERE id = $4
    `, [
      titledbGame.bannerUrl || null,
      titledbGame.iconUrl || null,
      titledbGame.screenshots?.[0] || null,
      game.id
    ]);

    console.log(`Updated ${game.id}`);
  }

  client.release();
  await pool.end();
}

main();
```

**Pros**: No need to manage persistent volume or caching
**Cons**: Depends on external CDN availability, slower load times

---

## Key Information for Next Session

### Database Connection
```bash
export DATABASE_URL="postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway"
```

### Staging URL
```
https://staging-production-c398.up.railway.app/video-games
```

### Local Image Location
```
C:\Users\Brendon\Documents\Claude\snp-site\data\video-game-images\switch\
```

### Image Count
- Total files: 1113
- Games with images: 371
- Games without: 140

### Titledb URL
```
https://raw.githubusercontent.com/blawar/titledb/master/US.en.json
```

### Sample Game for Testing
- **Name**: Mario Party Superstars
- **Title ID**: 01006FE013472000
- **NSUID**: 70010000027619
- **Files**:
  - `01006FE013472000_landscape.jpg`
  - `01006FE013472000_portrait.jpg`
  - `01006FE013472000_screenshot.jpg`

### Database Schema
```sql
-- video_games table columns for images
image_landscape_url TEXT
image_portrait_url TEXT
image_screenshot_url TEXT
```

---

## Likely Root Cause

**Most probable issue**: The API endpoint `/api/video-games/images/[id]` either:
1. Doesn't exist yet
2. Exists but looking in wrong directory
3. Exists but Railway volume not configured

**Check these files first**:
- `app/api/video-games/images/[id]/route.ts` (or similar path)
- `railway.json` - volume mounts
- `Dockerfile` - COPY commands

---

## Quick Win Alternative

If fixing the persistent volume is complex, **switch to direct CDN URLs**:

1. Update database to use titledb URLs directly (not cached)
2. Images load from `img-eshop.cdn.nintendo.net` on demand
3. No need for persistent volume or API endpoint
4. Run `scripts/update-to-use-titledb-urls.js` (create this script based on Step 5 above)

This bypasses the entire caching infrastructure and uses external CDN directly.
