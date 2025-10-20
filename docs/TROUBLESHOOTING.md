# Troubleshooting Guide

Quick reference for common issues and solutions.

---

## Deployment & Infrastructure Issues

### App Not Loading (Error 1016)

**Symptom:** "Origin DNS error" from Cloudflare when visiting sipnplay.cafe

**Diagnosis:**
1. Is Railway deployed? (Green status in dashboard)
2. Is Cloudflare CNAME correct?
3. Has DNS propagated? (Can take 5-30 minutes)

**Fixes:**
1. Verify Railway is deployed (check dashboard for green status)
2. Check Cloudflare CNAME target is correct:
   - Should point to: `snp-site-production.up.railway.app`
3. Wait 5-10 minutes for DNS propagation
4. Test DNS resolution: `nslookup sipnplay.cafe`

**If still failing:**
- Railway → Settings → Restart
- Cloudflare → DNS → Edit CNAME and re-save

---

### Games Not Loading

**Symptom:** App loads but games list is empty

**Fixes:**
1. Check AIRTABLE_API_KEY in Railway dashboard → Variables tab
2. Visit `/api/health` to check Airtable connectivity
3. Check Railway logs for "Airtable" errors
4. Try manual refresh: `curl -X POST https://sipnplay.cafe/api/games/refresh?full=true`

---

### Images Not Displaying

**Symptom:** Game cards show broken image icon

**Fixes:**
1. Try hard refresh to recache images: `curl -X POST https://sipnplay.cafe/api/games/refresh?full=true`
2. Check Railway logs for image fetch errors
3. Verify Airtable image URLs are valid (they expire after ~12 hours)

---

### Build Fails on Push

**Symptom:** GitHub Actions shows red ✗

**Fixes:**
1. Check GitHub Actions logs for build errors
2. Verify `npm run build` works locally
3. Check Node version: requires Node 20+
4. Look for TypeScript errors: `npx tsc --noEmit`

---

### Cache Corruption or Performance Issues

**Symptom:** Cache seems corrupt, or app is very slow

**Fixes:**
1. Delete: `data/image-cache-metadata.json` (will rebuild)
2. Do a full refresh: `curl -X POST https://sipnplay.cafe/api/games/refresh?full=true`
3. Check Railway metrics for memory/CPU spikes
4. Try restart: Railway → Settings → Restart

---

## Local Development Issues

### Dev Server Won't Start

**Symptom:** `npm run dev` fails or hangs

**Fixes:**
1. Clean dependencies: `rm -rf node_modules && npm install && npm run dev`
2. Kill old Node: `taskkill /F /IM node.exe` (Windows)
3. Check `.env.local` has `AIRTABLE_API_KEY`

---

### Build Fails Locally

**Symptom:** `npm run build` fails

**Fixes:**
1. Clean cache: `rm -rf .next && npm run build`
2. Check TypeScript: `npx tsc --noEmit`
3. Verify dependencies: `npm install`

---

## Testing & Verification

### Health Check

```bash
curl https://sipnplay.cafe/api/health
```

Should return healthy status with Airtable connected.

### Manual Cache Refresh

**Incremental:** `curl -X POST https://sipnplay.cafe/api/games/refresh`

**Full:** `curl -X POST https://sipnplay.cafe/api/games/refresh?full=true`

---

## Disaster Recovery

### App Completely Down

1. Railway auto-restarts crashed containers
2. Manual restart: Railway → Settings → Restart
3. Check Cloudflare CNAME is correct
4. Verify latest build succeeded on GitHub Actions

### Airtable Connectivity Lost

- App serves cached data gracefully
- Cache is served as-is (even if stale)
- No data loss, app stays online
- Auto-syncs when Airtable recovers

### Domain/DNS Problems

1. Check Cloudflare CNAME: should be `@` → `snp-site-production.up.railway.app`
2. Clear DNS cache: `ipconfig /flushdns` (Windows)
3. Test: `nslookup sipnplay.cafe`

---

**Last Updated:** October 20, 2025
**Current Version:** 1.2.0
