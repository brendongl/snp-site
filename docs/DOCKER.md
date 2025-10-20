# Docker & Production Build Guide

This guide covers how the app is built, containerized, and deployed to Railway.

---

## Overview

The app uses a **multi-stage Docker build** for optimized production images:

```
Dockerfile (Multi-Stage Build)
    ↓
Stage 1: deps      → Install node_modules
    ↓
Stage 2: builder   → Build Next.js app (npm run build)
    ↓
Stage 3: runner    → Final production image (minimal size)
    ↓
Push to GitHub Container Registry (GHCR)
    ↓
Railway auto-detects & deploys
    ↓
https://sipnplay.cafe
```

---

## Dockerfile Breakdown

### Stage 1: Dependencies (`deps`)
```dockerfile
FROM node:20-alpine AS deps
# Install libc6-compat for Alpine compatibility
# Copy package.json + package-lock.json
# Run: npm ci (clean install)
```

- Uses Alpine Linux (small base image)
- Caches dependencies layer for faster rebuilds

### Stage 2: Builder (`builder`)
```dockerfile
FROM base AS builder
# Copy node_modules from deps stage
# Copy entire codebase
# Set dummy environment variables (for build)
# Run: npm run build
# Outputs to .next/ directory
```

- Builds Next.js app
- Generates standalone output (no dependencies needed in final image)

### Stage 3: Runner (`runner`)
```dockerfile
FROM base AS runner
# Copy .next/static and .next/standalone from builder
# Create data/ directory for persistent cache
# Set user to non-root (security)
# Expose port 3000
# Start: node server.js
```

- Final production image
- Minimal size (only runtime files)
- Persistent storage for cache

---

## Build & Push (GitHub Actions)

**Automatic on every push to `main`:**

1. GitHub Actions workflow (`.github/workflows/docker-build.yml`) triggers
2. Builds multi-stage image
3. Tags as:
   - `ghcr.io/brendongl/snp-site:latest`
   - `ghcr.io/brendongl/snp-site:v1.0.6` (version-specific)
4. Pushes to GitHub Container Registry
5. Railway detects new image and auto-deploys

**No manual Docker commands needed** - it's fully automated!

---

## Local Docker Testing (Optional)

### Build Locally
```bash
# Build image (takes 3-5 minutes first time)
docker build -t snp-site:local .
```

### Run Locally
```bash
# Run with required environment variables
docker run -d \
  --name snp-site-test \
  -p 3000:3000 \
  -e AIRTABLE_API_KEY=key_xxxxxxxxxxxxx \
  -e AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu \
  -e AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr \
  -e AIRTABLE_GAMES_VIEW_ID=viwRxfowOlqk8LkAd \
  snp-site:local

# Or with docker-compose (if .env is set up)
docker-compose up
```

### View Logs
```bash
docker logs -f snp-site-test
```

### Stop Container
```bash
docker stop snp-site-test
docker rm snp-site-test
```

---

## Production Build Optimization

### Multi-Stage Benefits

**Without multi-stage:**
- Final image size: ~500 MB (includes node_modules)
- Deploy time: 2-3 minutes
- Runtime: Slow startup

**With multi-stage:**
- Final image size: ~150 MB (no node_modules)
- Deploy time: 30-60 seconds
- Runtime: Fast startup

### Output File Tracing

Next.js generates only necessary files:
```bash
# In .next/standalone/
node server.js  # Single command to start
```

This reduces image size and startup time.

---

## Persistent Storage on Railway

### Directory Structure
```
Container /app/
├── .next/           ← Next.js build (read-only)
├── public/          ← Static files
├── node_modules/    ← Dependencies (NOT included, installed at runtime)
└── data/            ← PERSISTENT (survives redeploys)
    ├── games-cache.json
    ├── image-cache-metadata.json
    ├── images/      ← Cached game images
    └── logs/        ← Application logs
```

### Persistent Data
- Games cache (1-hour TTL)
- Image cache (content-deduped)
- Application logs
- Survives app restarts and redeployments

---

## Environment Variables at Build Time

The Dockerfile sets dummy values for build-time:

```dockerfile
ENV AIRTABLE_API_KEY=dummy_key_for_build \
    AIRTABLE_GAMES_BASE_ID=dummy_base_id \
    ...
```

**Why?** Next.js validates environment variables during build. We use dummy values because:
1. Real values aren't needed to build (they're used at runtime)
2. Build is public in GitHub Actions (secrets wouldn't be safe here)
3. Railway provides real values at runtime

---

## Building for Production

### Using GitHub (Recommended)
1. Update version in `lib/version.ts` and `package.json`
2. Commit and push to `main`
3. GitHub Actions builds automatically
4. Railway auto-deploys

**You don't run Docker commands** - it's all automatic!

### Manual Build (if needed)
```bash
# Build and tag with version
docker build -t ghcr.io/brendongl/snp-site:1.0.6 .
docker build -t ghcr.io/brendongl/snp-site:latest .

# Push to GitHub Container Registry (requires auth)
docker login ghcr.io -u brendongl
docker push ghcr.io/brendongl/snp-site:1.0.6
docker push ghcr.io/brendongl/snp-site:latest
```

---

## Troubleshooting Docker Builds

### Build fails: "npm run build" error
**Fix:**
```bash
# Clean and rebuild locally
rm -rf .next node_modules
npm ci
npm run build
```

### Build fails: Out of memory
- Railway free tier: 512 MB
- Try: `npm run build` locally first to verify it works

### Container won't start: "Cannot find module"
**Fix:**
1. Check `.dockerignore` doesn't exclude necessary files
2. Verify `package.json` lists all dependencies
3. Check Dockerfile copies required files

### Port 3000 already in use
**Fix:** Railway uses port 3000, but you can:
1. Change `EXPOSE 3000` in Dockerfile (not recommended)
2. Or use different port locally: `docker run -p 3001:3000`

---

## Health Checks

### In-Container Health
```bash
# From inside container
curl http://localhost:3000/api/health
# Returns: { "status": "healthy", "airtable": "connected", ... }
```

### Docker Health Check
```bash
docker inspect snp-site-test | grep Health -A 10
```

### Railway Health Monitoring
1. Railway dashboard → Metrics tab
2. View CPU, Memory, Network usage
3. Check deployment status

---

## Docker Compose (Local Development)

If you want to run full stack locally:

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - AIRTABLE_API_KEY=${AIRTABLE_API_KEY}
      - AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
      - AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
      - AIRTABLE_GAMES_VIEW_ID=viwRxfowOlqk8LkAd

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

**Use:**
```bash
# Create .env file with AIRTABLE_API_KEY
echo "AIRTABLE_API_KEY=key_xxx" > .env

# Start stack
docker-compose up

# Stop
docker-compose down
```

---

## Performance Tuning

### Build Optimization
- Alpine Linux base (small)
- Multi-stage build (removes build dependencies)
- Layer caching (npm ci layer cached)

### Runtime Optimization
- Standalone Next.js build
- Minimal dependencies in image
- Persistent cache reduces API calls

### Deployment Time
- Local build: ~3-5 minutes
- GitHub Actions push: ~5-7 minutes total
- Railway redeploy: ~1-2 minutes

---

## Key Files

| File | Purpose |
|------|---------|
| [Dockerfile](Dockerfile) | Multi-stage build configuration |
| [.dockerignore](.dockerignore) | Files to exclude from image |
| [.github/workflows/docker-build.yml](.github/workflows/docker-build.yml) | GitHub Actions auto-build |
| [package.json](package.json) | Dependencies (used in Docker build) |

---

## Next Steps

- **For Development:** See [CLAUDE.md](CLAUDE.md)
- **For Production:** See [DEPLOYMENT.md](DEPLOYMENT.md)
- **For Railway Setup:** See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)

---

**Last Updated:** October 18, 2025
**Docker Base:** Node 20 Alpine
**Image Size:** ~150 MB
**Build Time:** ~5 minutes (first), ~2 minutes (cached)
