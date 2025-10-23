# Railway Persistent Volume Setup

## Purpose
Configure persistent storage for `/app/data` directory on Railway to preserve cached images and database files across container restarts and redeployments.

## Current Situation
- **Database**: PostgreSQL (managed - persists automatically)
- **Images**: Stored in `/app/data/images/` (ephemeral without volume - **gets wiped on restart**)
- **Image Metadata**: `/app/data/image-cache-metadata.json` (ephemeral - **gets wiped on restart**)

## Volume Configuration Required

### Option A: Railway Dashboard (Manual - Recommended for one-time setup)

1. **Go to Railway Project Dashboard**
   - Navigate to https://railway.app/project/[PROJECT_ID]
   - Select the "snp-site" service

2. **Add Volume**
   - Click "Settings" tab
   - Scroll to "Volumes" section
   - Click "Add Volume"
   - **Mount Path**: `/app/data`
   - **Size**: `10 GB` (sufficient for ~2000 cached images at 5MB avg)
   - Click "Create Volume"

3. **Trigger Redeploy**
   - Push a commit to staging branch (or use "Redeploy" button)
   - Railway will restart the service with the new volume
   - Container will have persistent storage at `/app/data`

4. **Verify**
   - Check logs: Volume should mount successfully
   - Images cached on first request will persist across restarts

### Option B: Railway CLI (Programmatic)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to project
railway link [PROJECT_ID]

# Add volume (if CLI supports it - check latest Railway docs)
railway volume add --mount-path /app/data --size 10Gi
```

## What Gets Persisted

Once volume is configured:

✅ **Preserved Across Restarts:**
- `/app/data/images/*.{jpg,png,gif,webp}` - Cached image files
- `/app/data/image-cache-metadata.json` - Image URL mappings
- `/app/data/logs/` - Application logs (optional)

✅ **Already Persisted (PostgreSQL):**
- All database tables and game data
- Content check history
- Staff knowledge data

❌ **Still Ephemeral:**
- `.next/` cache (rebuilt on each deploy - acceptable)
- `node_modules/` (rebuilt on each deploy - acceptable)

## Benefits

1. **Image Deduplication**: Same image bytes only stored once on disk
2. **Performance**: Cached images serve in ~10ms vs 200-500ms from Airtable
3. **Reliability**: Works even if Airtable URLs expire (~12 hour window)
4. **Cost**: Reduces bandwidth to Airtable API
5. **User Experience**: Faster image loads on repeat visits

## Image Cache Lifecycle

1. **First Request**: API fetches image from Airtable
2. **Cache Check**: Calculates MD5 hash of image bytes
3. **Deduplication**: Checks if identical bytes already cached
4. **Storage**: Stores on persistent volume at `/app/data/images/[hash].[ext]`
5. **Metadata**: Records mapping in `/app/data/image-cache-metadata.json`
6. **Subsequent Requests**: Serves from `/app/data/images/` (cache hit)

## Size Estimates

Current collection (361 games, 578 images):
- Average image size: ~2-8 MB
- Estimated total: 2-5 GB
- Deduplication factor: ~1.5x (same images used multiple times)
- **Allocation**: 10 GB covers ~2000 images with headroom

## Troubleshooting

### Volume appears but doesn't persist
- Ensure volume is mounted at `/app/data` (case-sensitive)
- Restart service after adding volume
- Check container logs: `docker logs [container_id]`

### Dockerfile permissions issue
- Already handled in `Dockerfile`:
  ```dockerfile
  RUN mkdir -p data data/images logs
  RUN chown -R nextjs:nodejs data logs
  ```

### Volume fills up
- Monitor with: `df -h /app/data`
- Clear cache: `GET /api/cache/clear` endpoint (if implemented)
- Or delete `.json` metadata file to reset

## Next Steps

1. ✅ **Add volume via Railway Dashboard** (takes 2 mins)
2. Push a new commit to trigger redeploy
3. First request will cache images
4. Verify by checking `/app/data/images/` directory exists and grows

## Related Documentation
- Railway Docs: https://docs.railway.app/databases/mysql
- Dockerfile: `./Dockerfile` (creates data directories)
- Image Cache: `./lib/cache/image-cache.ts` (caching logic)
