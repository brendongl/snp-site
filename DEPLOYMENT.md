# Complete Deployment & Architecture Guide

**Hosting Stack:** Railway → GitHub Actions → Cloudflare → sipnplay.cafe

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Workflow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Local Development (Your Computer)                           │
│     └─ npm run dev                                              │
│     └─ Test at http://localhost:3000                            │
│                                                                 │
│  2. Version Update & Git Push                                   │
│     └─ Update lib/version.ts & package.json                     │
│     └─ git push origin main                                     │
│                                                                 │
│  3. GitHub Actions (Automatic)                                  │
│     └─ Builds Docker image                                      │
│     └─ Pushes to ghcr.io/brendongl/snp-site:latest              │
│                                                                 │
│  4. Railway (Auto-detects new image)                            │
│     └─ Deploys container                                        │
│     └─ Starts at snp-site-production.up.railway.app             │
│                                                                 │
│  5. Cloudflare DNS (Your domain)                                │
│     └─ CNAME @ → snp-site-production.up.railway.app             │
│     └─ Resolves sipnplay.cafe → Railway IP                      │
│                                                                 │
│  6. User Access                                                 │
│     └─ Browser: https://sipnplay.cafe                           │
│     └─ ✅ App loads and serves Airtable data                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Local Development

### Prerequisites
- Node.js 20+ installed
- Git configured
- `.env.local` with `AIRTABLE_API_KEY`

### Development Commands
```bash
# Install dependencies (first time only)
npm install

# Start dev server (Turbopack, auto-reload)
npm run dev
# Opens on http://localhost:3000 (or next available port)

# Verify production build works
npm run build

# Run production locally (if testing)
npm start
```

### Before Every Commit
```bash
# 1. Update version (BOTH files!)
# Edit lib/version.ts:
#   export const VERSION = "1.0.7"
# Edit package.json:
#   "version": "1.0.7"

# 2. Test build
npm run build

# 3. Commit with version in message
git add .
git commit -m "v1.0.7 - Feature description

Brief description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push to GitHub
git push origin main
```

---

## Step 2: GitHub Actions (Automatic)

**What happens automatically when you push:**

1. GitHub Actions workflow triggers (`.github/workflows/docker-build.yml`)
2. Builds multi-stage Docker image using [Dockerfile](Dockerfile)
3. Pushes image to GitHub Container Registry:
   - `ghcr.io/brendongl/snp-site:latest`
   - `ghcr.io/brendongl/snp-site:v1.0.7` (version tag)
4. Build takes ~3-5 minutes

**You don't need to do anything** - it's fully automated!

### Verify Build Succeeded
1. Go to GitHub repo → "Actions" tab
2. Find your latest commit workflow
3. Should show green checkmark ✅
4. Click workflow to see logs if needed

---

## Step 3: Railway Deployment (Automatic)

Railway continuously watches your Docker image and auto-deploys.

### Current Setup
- **Project:** snp-site (on railway.app)
- **Image Source:** ghcr.io/brendongl/snp-site:latest
- **Environment Variables:** Set in Railway dashboard
- **Persistent Storage:** `data/` directory (cache, images, logs)
- **Port:** 3000 (internal) → Railway URL (external)

### Verify Railway Deployed
1. Go to [railway.app](https://railway.app)
2. Select "snp-site" project
3. Look for green "Deployment" status
4. Check logs for errors

**Railway URL:** `snp-site-production.up.railway.app`

### Manual Restart (if needed)
1. Railway dashboard → Settings tab
2. Click "Restart"
3. App will redeploy with current image

---

## Step 4: Cloudflare DNS Configuration

Your domain is registered at Namecheap but uses Cloudflare's nameservers for DNS management.

### Current Configuration
| Type | Name | Target | Proxy | TTL |
|------|------|--------|-------|-----|
| CNAME | @ (root) | snp-site-production.up.railway.app | DNS only | Auto |

### How It Works
```
1. User visits: https://sipnplay.cafe
   ↓
2. Cloudflare DNS lookup: "@" CNAME record
   ↓
3. Resolves to: snp-site-production.up.railway.app
   ↓
4. Railway IP returns HTTP response
   ↓
5. Browser displays app on https://sipnplay.cafe
```

### Modifying DNS (if needed)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select "sipnplay.cafe" domain
3. DNS tab → Edit records
4. Update CNAME target if Railway URL changes
5. Save (usually propagates in 5-30 minutes)

---

## Step 5: Environment Variables

Railway must have these variables set for the app to work:

### Required Variables
```
AIRTABLE_API_KEY = key_xxxxxxxxxxxxx
AIRTABLE_GAMES_BASE_ID = apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID = tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID = viwRxfowOlqk8LkAd
```

### Optional (add as needed)
```
AIRTABLE_CUSTOMER_BASE_ID = appoZWe34JHo21N1z
AIRTABLE_CUSTOMER_TABLE_ID = tblfat1kxUvaNnfaQ
DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/...
NEXTAUTH_URL = https://sipnplay.cafe
NEXTAUTH_SECRET = (use: openssl rand -base64 32)
```

### Update Variables
1. Railway dashboard → Variables tab
2. Edit any variable
3. Save → Auto-redeploy with new values

---

## Step 6: Data & Caching

Your app caches data locally to improve performance and resilience.

### Three Caching Layers

#### 1. Games Cache (1-hour TTL)
- **File:** `data/games-cache.json`
- **Purpose:** Cache Airtable games list
- **Strategy:** Cache-first with Airtable fallback
- **Endpoints:**
  - `GET /api/games` - Returns cached games
  - `POST /api/games/refresh` - Incremental refresh
  - `POST /api/games/refresh?full=true` - Hard refresh (recaches images)

#### 2. Image Cache (Persistent)
- **Location:** `data/images/` + `data/image-cache-metadata.json`
- **Purpose:** Deduplicate and cache images from Airtable
- **Strategy:** Content-based (MD5 hash) deduplication
- **Benefits:** Saves bandwidth, faster loads

#### 3. Browser Cache
- **Images:** 1 year (immutable)
- **API:** No caching (always fresh from Railway)

### Persistent Storage on Railway
- `data/` directory persists between deployments
- Cache survives app restarts
- Images are deduplicated (saves space)

---

## Troubleshooting

### App Not Loading (Error 1016)
**Symptom:** "Origin DNS error" from Cloudflare

**Fix:**
1. Verify Railway is deployed (green status)
2. Check Cloudflare CNAME target is correct
3. Wait 5-10 minutes for DNS propagation
4. Try: `nslookup sipnplay.cafe`

### Games Not Loading
**Symptom:** App loads but games list empty

**Fixes:**
1. Check `AIRTABLE_API_KEY` is correct in Railway
2. Visit `/api/health` to check Airtable connectivity
3. Railway logs for errors (Dashboard → Logs)
4. Try manual refresh: `POST /api/games/refresh?full=true`

### Images Not Displaying
**Symptom:** Game images show broken icon

**Fixes:**
1. Verify image cache exists: `data/images/` and `data/image-cache-metadata.json`
2. Try hard refresh: `POST /api/games/refresh?full=true`
3. Check Railway logs for image fetch errors
4. Verify Airtable image URLs are accessible

### Build Fails on Push
**Symptom:** GitHub Actions shows red ✗

**Fixes:**
1. Check GitHub Actions logs for build errors
2. Verify `npm run build` works locally
3. Check Node version compatibility
4. Review recent code changes

---

## Monitoring & Health Checks

### Health Endpoint
```bash
curl https://sipnplay.cafe/api/health
```

Returns:
```json
{
  "status": "healthy",
  "airtable": "connected",
  "cacheStatus": "fresh",
  "version": "1.0.6"
}
```

### View Logs
1. Railway dashboard → Logs tab
2. Real-time app output
3. Search for errors or specific patterns

### Monitor Metrics
1. Railway dashboard → Metrics tab
2. CPU, Memory, Network usage
3. Upgrade plan if consistently high

---

## Disaster Recovery

### If App Crashes
1. Railway auto-restarts crashed containers
2. Data in `data/` persists
3. Manual restart: Railway → Settings → Restart

### If DNS Breaks
1. Update CNAME in Cloudflare DNS
2. Wait for propagation (5-30 minutes)
3. Or access via temporary Railway URL

### If Cache Corrupts
1. Delete `data/image-cache-metadata.json`
2. Next `/api/games/refresh?full=true` rebuilds it
3. Or restart Railway (clears memory cache)

### If Airtable Goes Down
1. App returns cached data gracefully
2. Cache is served as-is (even if stale)
3. No data loss, app stays online

---

## Cost & Performance

### Current Costs
- **Railway:** Free tier (~500 hours/month)
- **Cloudflare:** Free tier (DNS only)
- **Airtable:** Your existing plan
- **Namecheap:** Domain registration (~$0.99/year promo)

**Total: ~$0-5/month**

### Performance Notes
- Cold start time: ~5-10 seconds (first load after deploy)
- Cache hits: <500ms
- Image loads: 1-3 seconds (first time), <500ms (cached)
- Supports hundreds of concurrent users on free tier

---

## Common Tasks

### Deploy a Code Change
```bash
# 1. Make changes locally
# 2. Test: npm run build && npm start
# 3. Update version (lib/version.ts + package.json)
# 4. Commit & push
git add .
git commit -m "vX.Y.Z - Description"
git push origin main
# 5. Wait 5-10 minutes for Railway to deploy
# 6. Visit https://sipnplay.cafe to verify
```

### Add Environment Variable
1. Railway dashboard → Variables
2. Add new variable
3. Save → Auto-redeploy

### Update Airtable Fields
1. Add field in Airtable
2. Update `types/index.ts` (type definitions)
3. Update `lib/airtable/games-service.ts` (field references)
4. Commit & push (auto-deploys)

### Force Cache Refresh
```bash
# Incremental refresh (quick)
curl -X POST https://sipnplay.cafe/api/games/refresh

# Full refresh (recaches images)
curl -X POST https://sipnplay.cafe/api/games/refresh?full=true
```

---

## Key Files & References

| File | Purpose |
|------|---------|
| [lib/version.ts](lib/version.ts) | Version constant (update with package.json) |
| [package.json](package.json) | Dependencies + version (keep in sync) |
| [Dockerfile](Dockerfile) | Container configuration (multi-stage build) |
| [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml) | GitHub Actions (auto-build on push) |
| [lib/airtable/games-service.ts](lib/airtable/games-service.ts) | Airtable integration |
| [lib/cache/games-cache.ts](lib/cache/games-cache.ts) | Games cache logic |
| [lib/cache/image-cache.ts](lib/cache/image-cache.ts) | Image caching & deduplication |
| [app/api/health.ts](app/api/health.ts) | Health check endpoint |

---

## Quick Reference: URLs

**Production (Live):**
- Domain: `https://sipnplay.cafe`
- API: `https://sipnplay.cafe/api/games`
- Health: `https://sipnplay.cafe/api/health`

**Management:**
- Railway: `https://railway.app/dashboard`
- Cloudflare: `https://dash.cloudflare.com`
- GitHub: `https://github.com/brendongl/snp-site`
- Airtable: Your Board Games base

---

---

## For First-Time Railway Setup

If you're setting up Railway for the first time, see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for complete step-by-step instructions including:
- Creating a Railway account
- Connecting your GitHub repository
- Configuring environment variables
- Adding your custom domain via Cloudflare DNS

---

**Last Updated:** October 20, 2025
**Current Version:** 1.2.0
**Infrastructure:** Railway + Cloudflare + GitHub Actions
