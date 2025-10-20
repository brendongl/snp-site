# Railway Deployment Guide for Sip N' Play Portal

Complete guide to deploy your Next.js app to Railway and connect your sipnplay.cafe domain.

---

## Part 1: Set Up Railway Account

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Click "Start Project" button
3. Sign up with GitHub (recommended - easier integration)
4. Authorize Railway to access your GitHub account

### Step 2: Create New Project
1. Click "New Project" button
2. Select "Deploy from GitHub repo"
3. If prompted, authorize Railway to access your repositories

---

## Part 2: Deploy Your App to Railway

### Step 3: Connect Your Repository
1. After authorizing, you'll see your repositories list
2. Find and click on `snp-site` repository
3. Railway will auto-detect it's a Next.js app (from package.json)
4. You'll be taken to a new project dashboard

### Step 4: Configure Build Settings
Railway should auto-detect your Next.js setup, but verify:
- **Build Command:** `npm run build` (should auto-fill)
- **Start Command:** `npm start` (should auto-fill)
- **Node Version:** 20 or 22 (Alpine, matches your Dockerfile)

### Step 5: Add Environment Variables
1. In Railway dashboard, go to **Variables** tab
2. Click "Add Variable" for each environment variable:

**Required Variables:**
```
AIRTABLE_API_KEY = key_xxxxxxxxxxxxx
AIRTABLE_GAMES_BASE_ID = apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID = tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID = viwRxfowOlqk8LkAd
```

**Optional Variables (add if you use them):**
```
AIRTABLE_CUSTOMER_BASE_ID = appoZWe34JHo21N1z
AIRTABLE_CUSTOMER_TABLE_ID = tblfat1kxUvaNnfaQ
DISCORD_WEBHOOK_URL = https://discord.com/api/webhooks/xxxxx
NEXTAUTH_URL = https://sipnplay.cafe
NEXTAUTH_SECRET = [generate with: openssl rand -base64 32]
```

**To Generate NEXTAUTH_SECRET:**
```bash
# Run this in your terminal (Windows PowerShell or Git Bash)
openssl rand -base64 32
# Copy the output and paste it into Railway
```

### Step 6: Deploy
1. After adding variables, click "Deploy"
2. Railway will:
   - Build your Docker image
   - Run `npm run build`
   - Start your app on port 3000
3. Watch the deployment logs in the dashboard
4. Once deployment completes, you'll see a green checkmark

### Step 7: Get Your Railway URL
1. In the project dashboard, click "Domains" or look for a URL
2. Railway generates a temporary URL like: `snp-site-production.up.railway.app`
3. **Save this URL** - you'll need it for Cloudflare

---

## Part 3: Connect Your Domain (sipnplay.cafe)

Your domain is currently pointing to Namecheap but uses Cloudflare for DNS. This is perfect - you'll add a CNAME record in Cloudflare.

### Step 8: Get Your Railway Domain
1. In Railway dashboard, find the **Domains** section
2. Click "Add Domain"
3. Enter: `sipnplay.cafe`
4. Railway will give you a CNAME target (usually something like `railway.app`)

**OR** if Railway doesn't support custom domains directly:

1. Copy your temporary Railway URL: `snp-site-production.up.railway.app`
2. Go to Cloudflare dashboard
3. Select your domain `sipnplay.cafe`
4. Go to **DNS** tab
5. Click **Add Record**
   - **Type:** CNAME
   - **Name:** @ (or leave empty - means root domain)
   - **Target:** `snp-site-production.up.railway.app`
   - **TTL:** Auto
   - **Proxy status:** Proxied (orange cloud) or DNS only (gray cloud)
     - Choose **Proxied** for Cloudflare protection/caching
     - Choose **DNS only** for direct Railway IP
6. Click **Save**

### Step 9: Update Next.js Configuration
Update `NEXTAUTH_URL` environment variable in Railway:

1. Go back to Railway dashboard
2. Click **Variables**
3. Find or add `NEXTAUTH_URL`
4. Set value to: `https://sipnplay.cafe`
5. Save - this will trigger a redeploy

### Step 10: Wait for DNS Propagation
- DNS usually propagates within 5-30 minutes
- Check status: `nslookup sipnplay.cafe` or use [whatsmydns.net](https://whatsmydns.net)
- Once propagated, visit https://sipnplay.cafe in your browser

---

## Part 4: Verify Everything Works

### Test Your Deployment

**Checklist:**
- [ ] Visit `https://sipnplay.cafe` - should load your app
- [ ] Games page loads and displays games from Airtable
- [ ] Images display correctly
- [ ] No console errors (open browser DevTools)
- [ ] Staff mode works: `https://sipnplay.cafe/games?staff=true`
- [ ] API health check: `https://sipnplay.cafe/api/health`

### Common Issues

**Domain shows "Offline" in Cloudflare:**
- Wait 5-10 more minutes for propagation
- Check DNS: `nslookup sipnplay.cafe` should show Railway IP
- Try from incognito browser (clear cache)

**Games don't load:**
- Check Railway logs for API errors
- Verify `AIRTABLE_API_KEY` is correct in Railway
- Check Airtable API isn't rate-limited

**Images don't load:**
- Check if Cloudflare image optimization is interfering
- Try disabling Cloudflare's "Polish" feature temporarily
- Verify `data/images` directory exists on Railway (persistent storage)

**HTTPS shows security warning:**
- Wait for Let's Encrypt certificate generation (automatic, can take 1-2 hours)
- Or use Railway's automatic SSL (should be enabled by default)

---

## Part 5: Set Up Auto-Deployments

Railway auto-deploys when you push to GitHub's `main` branch (if configured):

### Enable Auto-Deploy
1. In Railway project, go to **Settings**
2. Look for "GitHub" or "Deployment" section
3. Enable "Automatically deploy from main branch"
4. Toggle "Deploy on push" to ON

Now whenever you push code:
```bash
git add .
git commit -m "vX.Y.Z - Your changes"
git push origin main
```

Railway will automatically rebuild and redeploy your app!

---

## Part 6: Monitoring & Maintenance

### View Logs
1. In Railway dashboard, click **Logs** tab
2. See real-time application output
3. Search for errors

### Monitor Performance
1. Click **Metrics** tab
2. View CPU, Memory, and Network usage
3. Check if you need to upgrade plan

### Restart App (if needed)
1. Click **Settings** → **Restart**
2. Your app will redeploy with current code

### Update Environment Variables
1. Go to **Variables** tab
2. Edit any variable
3. Save - automatically triggers redeploy

---

## Part 7: Cost & Scaling

### Current Setup Cost
- **Free tier:** ~500 hours/month of free computation (~$10-15 value)
- **Paid tier:** $5/month base + usage
- **Your app:** Probably uses 10-50 hours/month with low traffic

**Expected monthly cost: FREE or $2-5**

### When You Need to Scale
If traffic grows significantly:
1. Railway has automatic scaling
2. Or upgrade plan in **Settings** → **Plan**

---

## Troubleshooting Commands

### SSH into Railway container (if available)
```bash
# Usually not needed, but Railway may offer SSH access
# Check Settings tab for "Open Shell" option
```

### Manual cache refresh (after deployment)
```bash
curl -X POST https://sipnplay.cafe/api/games/refresh
curl -X POST https://sipnplay.cafe/api/games/refresh?full=true
```

### Check health
```bash
curl https://sipnplay.cafe/api/health
```

---

## Next Steps

1. **Immediate:** Follow Steps 1-7 to deploy to Railway
2. **Then:** Configure your domain with Cloudflare (Steps 8-10)
3. **Finally:** Test everything works (Part 4)

If you get stuck, check Railway's documentation: https://docs.railway.app

---

## Quick Reference: Your URLs

**After deployment:**
- Public domain: `https://sipnplay.cafe`
- Railway dashboard: `https://railway.app/dashboard`
- Cloudflare DNS: `https://dash.cloudflare.com`
- Namecheap nameservers: `https://www.namecheap.com/domains`

---

**Last Updated:** 2025-10-18
**App Version:** 1.0.6
