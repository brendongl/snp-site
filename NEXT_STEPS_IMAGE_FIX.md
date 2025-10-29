# Next Steps - Video Game Image Fix (v1.12.16)

**Status**: Fixed entrypoint script to sync all 3227 images from Docker to Railway volume. Awaiting deployment verification.

## What Was Fixed

**Problem:** Only ~30% of video game images loading on staging (15/50 visible, rest showing 400 errors).

**Root Cause:** `docker-entrypoint.sh` had threshold check `if [ "$FILE_COUNT" -lt 1000 ]` that skipped seeding if volume already had ≥1000 files.

**Solution:** Changed to always-sync logic with `cp -rn` to copy ALL images from Docker build to Railway volume on every container start.

## Verification Steps (After Deployment)

### 1. Check Deployment Status
- [ ] Confirm v1.12.16 deployed to staging (https://staging-production-c398.up.railway.app/video-games)
- [ ] Check Railway logs for entrypoint script output:
  - Should show: "📦 Video game images in Docker image: 3227 files"
  - Should show: "🔄 Syncing video game images from Docker image to volume..."
  - Should show: "✅ Video game images on volume: 3227 files"

### 2. Use Playwright MCP to Verify Images
```
mcp__playwright__browser_navigate({ url: "https://staging-production-c398.up.railway.app/video-games" })
mcp__playwright__browser_wait_for({ time: 5 })
mcp__playwright__browser_take_screenshot({ fullPage: true })
mcp__playwright__browser_network_requests()
```

**Expected Results:**
- ✅ ALL images load (no 400 errors in network tab)
- ✅ No broken image placeholders
- ✅ All game cards show proper Nintendo game covers

### 3. Spot Check Specific Images
Previously failing images that should now work:
- `9b6d27a856481410762d90caf1440d50.jpg`
- `61f5b0e5e4c7caf7eab5df3759c7dd72.jpg`

## Cleanup Tasks (After Verification)

### Scripts to Archive
Move to `scripts/archive/image-migration/`:
- `scripts/upload-video-game-images-to-*.js`
- `scripts/update-video-game-urls-*.js`
- `test-*-images.js`
- `verify-images-deployed.js`

## Success Criteria

✅ **All 511 games display images**
✅ **Zero 400/404 errors in console**
✅ **Railway volume contains 3227 files**

---

**Deployed:** v1.12.16 to staging at 10:47:54
**Verification Due:** 10:55:54
