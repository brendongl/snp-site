# Phase 1: iPOS Direct API Integration ✅

**Priority**: ✅ COMPLETED
**Solution**: Direct API calls to posapi.ipos.vn
**Date Implemented**: November 8, 2025

---

## Problem Statement (RESOLVED)

Original issue: iPOS scraping via Playwright was slow (5-10 seconds) and required browser automation.

**Solution Found**: Direct API calls to `posapi.ipos.vn` work perfectly without CORS issues!

---

## Solution Implemented

### Discovery
- `fabi.ipos.vn` uses server-side rendering (returns HTML)
- Found the actual API at `posapi.ipos.vn` used by the dashboard
- API requires BOTH tokens:
  - `access_token`: 32-character hexadecimal token
  - `authorization`: JWT bearer token

### Implementation
1. Created `lib/services/ipos-api-service.ts` for direct API calls
2. Updated `/api/pos/dashboard` route to use the new service
3. Created `scripts/get-ipos-access-token.js` to capture both tokens
4. Removed dependency on Playwright for POS data

---

## Performance Results

| Method | Response Time | Resource Usage | Reliability |
|--------|--------------|----------------|-------------|
| **Before (Playwright)** | 5-10 seconds | Full browser | Medium |
| **After (Direct API)** | ~100ms | Minimal | High |

**Improvement: 50-100x faster!** 🚀

---

## Files Created/Updated

### New Files
- `lib/services/ipos-api-service.ts` - Direct API service
- `scripts/get-ipos-access-token.js` - Token capture script
- `docs/IPOS_DIRECT_API_GUIDE.md` - Complete implementation guide

### Updated Files
- `app/api/pos/dashboard/route.ts` - Now uses direct API
- `docs/IPOS_API_ENDPOINTS.md` - Updated with correct endpoints
- `CLAUDE.md` - Added iPOS Direct API Integration section

### Removed Files
- `lib/services/ipos-service.ts` - Outdated service (wrong endpoint)

### Can Be Removed Later
- `lib/services/ipos-playwright-service.ts` - No longer needed
- Playwright dependencies from package.json (once confirmed in production)

---

## How to Use

### 1. Get Both Tokens
```bash
# Add credentials to .env
IPOS_EMAIL=sipnplay@ipos.vn
IPOS_PASSWORD=your_password

# Run capture script
node scripts/get-ipos-access-token.js
```

### 2. Configure Environment
```bash
# Add to .env
IPOS_ACCESS_TOKEN=<32_char_hex_token>
IPOS_AUTH_TOKEN=<jwt_bearer_token>
```

### 3. Test the API
```bash
npm run dev
curl http://localhost:3000/api/pos/dashboard
```

---

## Verified Working

Real production data received:
- Revenue: 9,665,372 VND
- Unpaid: 4,529,555 VND
- Tables: 10 active
- Bills: 25

---

## Docker Changes Not Needed

Since we're using direct API calls instead of Playwright:
- No need to install Playwright browsers in Docker
- No need for `npx playwright install` in Dockerfile
- Smaller Docker image size
- Faster build times

---

## Next Steps

1. ✅ Direct API working in development
2. ⏳ Deploy to staging for testing
3. ⏳ Deploy to production after confirmation
4. ⏳ Remove Playwright dependencies once stable

---

## Related Documentation

- [IPOS_DIRECT_API_GUIDE.md](../IPOS_DIRECT_API_GUIDE.md) - Complete implementation guide
- [IPOS_API_ENDPOINTS.md](../IPOS_API_ENDPOINTS.md) - API endpoints reference
- [lib/services/ipos-api-service.ts](../../lib/services/ipos-api-service.ts) - Service implementation