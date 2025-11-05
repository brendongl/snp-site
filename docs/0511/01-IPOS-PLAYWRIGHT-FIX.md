# Phase 1: Fix iPOS Playwright on Railway

**Priority**: 🔴 Critical
**Effort**: Small (30-45 minutes)
**Dependencies**: None
**Affects**: Production iPOS scraping feature

---

## Problem Statement

iPOS scraping feature fails on Railway with error:
```
[iPOS] Error fetching dashboard data: Error: browserType.launch: Executable doesn't exist at /nonexistent/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell
```

The Playwright browsers are not installed in the Docker container on Railway.

---

## Root Cause

Railway Docker container doesn't have Playwright browsers installed during build process. The Playwright installation requires:
1. `npx playwright install` command to download browser binaries
2. System dependencies for Chromium to run in headless mode

---

## Solution

### Option A: Add to Dockerfile (Recommended)
Add Playwright browser installation to the Docker build process.

**Files to modify:**
- [Dockerfile](../../Dockerfile)

**Changes:**
```dockerfile
# After npm install, add:
RUN npx playwright install --with-deps chromium
```

**Full context** (add after line with `RUN npm ci`):
```dockerfile
# Install dependencies
RUN npm ci --omit=dev

# Install Playwright browsers (for iPOS scraping)
RUN npx playwright install --with-deps chromium

# Build application
RUN npm run build
```

### Option B: Railway Build Command (Alternative)
Modify Railway build command to include Playwright installation.

**Where**: Railway dashboard → Settings → Build & Deploy → Build Command

**Command**:
```bash
npm install && npx playwright install --with-deps chromium && npm run build
```

---

## Implementation Steps

### Step 1: Update Dockerfile
1. Open [Dockerfile](../../Dockerfile)
2. Find the line `RUN npm ci --omit=dev`
3. Add after it:
   ```dockerfile
   # Install Playwright browsers for iPOS scraping
   RUN npx playwright install --with-deps chromium
   ```

### Step 2: Test Locally (Optional)
```bash
# Build Docker image locally
docker build -t snp-site-test .

# Run container
docker run -p 3000:3000 --env-file .env snp-site-test

# Test iPOS endpoint
curl http://localhost:3000/api/admin/ipos-dashboard
```

### Step 3: Commit Changes
```bash
git add Dockerfile
git commit -m "v1.5.6 - Fix iPOS Playwright on Railway

Add Playwright browser installation to Docker build process

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Step 4: Deploy to Staging
```bash
git push origin staging
```

### Step 5: Test on Staging
1. Wait for Railway deployment to complete
2. Navigate to staging admin page
3. Click "Refresh iPOS Data" or access `/api/admin/ipos-dashboard`
4. Verify no Playwright errors in logs

### Step 6: Deploy to Production (after user approval)
```bash
# Only after user says "push to main"
git push origin main
```

---

## Testing Checklist

- [ ] Dockerfile updated with Playwright installation
- [ ] Local Docker build succeeds
- [ ] Staging deployment succeeds
- [ ] iPOS scraping works on staging (no browser errors)
- [ ] Admin POS page shows table data correctly
- [ ] User approval received
- [ ] Production deployment succeeds
- [ ] iPOS scraping works on production

---

## Rollback Plan

If deployment fails:
1. Revert Dockerfile changes
2. Redeploy previous version
3. Investigate build logs for issues

---

## Estimated Timeline

- **Implementation**: 15 minutes
- **Testing**: 15 minutes
- **Deployment**: 15 minutes
- **Total**: ~45 minutes

---

## Related Files

- [Dockerfile](../../Dockerfile) - Main file to modify
- [lib/services/ipos-playwright-service.ts](../../lib/services/ipos-playwright-service.ts) - Service that uses Playwright
- [app/api/admin/ipos-dashboard/route.ts](../../app/api/admin/pos-settings/page.tsx) - API endpoint
- [docs/IPOS_API_ENDPOINTS.md](../IPOS_API_ENDPOINTS.md) - iPOS documentation

---

## Notes

- Installing `chromium` only (not all browsers) keeps Docker image size smaller
- `--with-deps` installs system dependencies needed for Chromium
- This fix doesn't affect local development (Playwright already installed locally)
- Future consideration: Add health check endpoint to verify Playwright is ready
