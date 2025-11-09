# iPOS Microservice

Tiny Express.js service that scrapes iPOS dashboard data using Playwright.

## Why?

Railway doesn't support Playwright well, so we deploy this separately to Render.com (which does).

## Architecture

```
Railway (Main App)
    ↓ HTTP GET request
Render (This Microservice)
    ↓ Uses Playwright to get data
Railway receives JSON response
```

## Deploy to Render.com (Free)

1. **Push this directory to a Git repo** (or use a subdirectory of your main repo)

2. **Create a new Web Service on Render:**
   - Go to https://dashboard.render.com
   - Click "New" → "Web Service"
   - Connect your Git repository
   - If using a subdirectory, set "Root Directory" to `ipos-microservice`

3. **Configure the service:**
   - **Name:** `ipos-microservice`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npx playwright install chromium --with-deps`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

4. **Add environment variables:**
   - `IPOS_EMAIL` = `sipnplay@ipos.vn`
   - `IPOS_PASSWORD` = `your_password`

5. **Deploy!**
   - Render will give you a URL like: `https://ipos-microservice.onrender.com`

## Test It

Once deployed, test the endpoint:

```bash
curl https://ipos-microservice.onrender.com/health
curl https://ipos-microservice.onrender.com/ipos-dashboard
```

## Use from Railway

In your Railway app, update the iPOS service to call this microservice:

```typescript
// lib/services/ipos-remote-service.ts
const IPOS_MICROSERVICE_URL = process.env.IPOS_MICROSERVICE_URL ||
  'https://ipos-microservice.onrender.com';

export async function getDashboardData() {
  const response = await fetch(`${IPOS_MICROSERVICE_URL}/ipos-dashboard`);
  const json = await response.json();
  return json.data;
}
```

## Performance

- **First request:** ~10 seconds (Playwright login + scrape)
- **Cached requests:** <100ms (returns cached data)
- **Cache duration:** 5 minutes

## Cost

**FREE!** Render's free tier is perfect for this:
- 750 hours/month free compute
- Automatic SSL
- Custom domains supported
- Scales to zero when not used

## Alternative: fly.io

If you prefer fly.io:

```bash
cd ipos-microservice
fly launch
fly secrets set IPOS_EMAIL=sipnplay@ipos.vn IPOS_PASSWORD=your_password
fly deploy
```

## Local Development

```bash
cd ipos-microservice
npm install
npx playwright install chromium
IPOS_PASSWORD=your_password npm run dev
```

Test:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/ipos-dashboard
```

## Monitoring

Check logs on Render:
- Dashboard → Your Service → Logs
- Look for `[iPOS Microservice]` prefix

## Troubleshooting

### "Failed to launch browser"
- Check that Playwright was installed correctly
- Verify build command includes: `npx playwright install chromium --with-deps`

### 401 errors from iPOS
- Verify IPOS_EMAIL and IPOS_PASSWORD are correct
- Check Render environment variables

### Slow responses
- First request after idle is always slow (~10s) - this is normal
- Render free tier spins down after 15 minutes of inactivity
- Consider upgrading to paid tier if you need instant responses

## Security

- Only exposes two endpoints: `/health` and `/ipos-dashboard`
- No authentication needed (can add API key if desired)
- Credentials stored in Render environment variables (encrypted)
- No data storage - purely a scraping proxy

## Questions?

This is the simplest, most reliable solution for iPOS data on Railway.
