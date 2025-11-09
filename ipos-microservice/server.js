// iPOS Microservice - Tiny Express server that provides iPOS data
// Deploy this to Render.com or fly.io (both support Playwright well)
// Railway calls this service's API to get iPOS data

const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3001;

// Credentials from environment
const IPOS_EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const IPOS_PASSWORD = process.env.IPOS_PASSWORD;

if (!IPOS_PASSWORD) {
  console.error('ERROR: IPOS_PASSWORD environment variable is required');
  process.exit(1);
}

// Cache to reduce Playwright overhead
let cachedData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchIPOSData() {
  console.log('[iPOS Microservice] Fetching fresh data via Playwright...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let apiData = null;

  // Set up response listener
  page.on('response', async (response) => {
    if (response.url().includes('sale-summary/overview') && response.status() === 200) {
      try {
        apiData = await response.json();
        console.log('[iPOS Microservice] ✅ Captured API data');
      } catch (error) {
        console.error('[iPOS Microservice] Error parsing API response:', error);
      }
    }
  });

  try {
    // Login
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="email_input"]', IPOS_EMAIL);
    await page.fill('input[type="password"]', IPOS_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    // Wait for dashboard and API call
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });
    await page.waitForTimeout(5000); // Wait for API calls to complete

    if (!apiData) {
      throw new Error('Failed to capture API data from dashboard');
    }

    // Extract the relevant fields
    const data = apiData.data || {};
    const saleTracking = data.sale_tracking || {};

    const result = {
      unpaidAmount: saleTracking.total_amount || 0,
      paidAmount: data.revenue_net || 0,
      currentTables: saleTracking.table_count || 0,
      currentCustomers: saleTracking.people_count || 0,
      lastUpdated: new Date().toISOString()
    };

    return result;
  } finally {
    await browser.close();
  }
}

// Single API endpoint
app.get('/ipos-dashboard', async (req, res) => {
  try {
    // Return cached data if still valid
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
      console.log('[iPOS Microservice] Returning cached data');
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch fresh data
    const data = await fetchIPOSData();

    // Update cache
    cachedData = data;
    cacheTimestamp = now;

    res.json({
      success: true,
      data: data,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[iPOS Microservice] Error:', error);

    // Return stale cache if available
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
        stale: true,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'iPOS Microservice',
    timestamp: new Date().toISOString(),
    cacheValid: cachedData && Date.now() - cacheTimestamp < CACHE_DURATION
  });
});

app.listen(PORT, () => {
  console.log(`[iPOS Microservice] Server running on port ${PORT}`);
  console.log(`[iPOS Microservice] Endpoints:`);
  console.log(`  - GET /ipos-dashboard - Get iPOS dashboard data`);
  console.log(`  - GET /health - Health check`);
});
