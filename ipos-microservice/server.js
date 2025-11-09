// Railway Playwright Template - iPOS Server
// Add this to the deployed Playwright template service

const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

const IPOS_EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const IPOS_PASSWORD = process.env.IPOS_PASSWORD;

let cachedData = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchIPOSData() {
  console.log('[iPOS Microservice] Fetching data via Playwright');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });

    // Login
    await page.fill('input[name="email_input"]', IPOS_EMAIL);
    await page.fill('input[type="password"]', IPOS_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    // Wait for dashboard
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Extract data
    const data = await page.evaluate(() => {
      const textContent = document.body.innerText;
      const lines = textContent.split('\n');

      let unpaidAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Hiện tại ở quán')) {
          if (i + 1 < lines.length) {
            const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
            if (match) unpaidAmount = parseFloat(match[1].replace(/,/g, ''));
          }
          break;
        }
      }

      let paidAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Doanh thu (NET)')) {
          if (i + 1 < lines.length) {
            const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
            if (match) paidAmount = parseFloat(match[1].replace(/,/g, ''));
          }
          break;
        }
      }

      const tableText = document.body.innerText.match(/Có\s+(\d+)\s+bàn\s+\/\s+(\d+)\s+bàn/);
      const currentTables = tableText ? parseInt(tableText[1]) : 0;

      const customerText = document.body.innerText.match(/Tổng:\s+(\d+)\s+khách/);
      const currentCustomers = customerText ? parseInt(customerText[1]) : 0;

      return { unpaidAmount, paidAmount, currentTables, currentCustomers };
    });

    return {
      ...data,
      lastUpdated: new Date().toISOString()
    };

  } finally {
    await browser.close();
  }
}

app.get('/ipos-dashboard', async (req, res) => {
  try {
    const now = Date.now();

    // Return cached if valid
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('[iPOS Microservice] Returning cached data');
      return res.json({
        success: true,
        data: cachedData,
        cached: true,
        cacheAge: Math.round((now - cacheTimestamp) / 1000)
      });
    }

    // Check credentials
    if (!IPOS_PASSWORD) {
      return res.status(500).json({
        success: false,
        error: 'IPOS_PASSWORD not configured'
      });
    }

    // Fetch fresh data
    const data = await fetchIPOSData();
    cachedData = data;
    cacheTimestamp = now;

    console.log('[iPOS Microservice] Fresh data fetched:', data);

    res.json({
      success: true,
      data,
      cached: false
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
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'iPOS Microservice (Railway)',
    uptime: process.uptime(),
    cacheAge: cachedData ? Math.round((Date.now() - cacheTimestamp) / 1000) : null
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[iPOS Microservice] Running on port ${PORT}`);
  console.log(`[iPOS Microservice] Listening on 0.0.0.0:${PORT}`);
  console.log(`[iPOS Microservice] Email: ${IPOS_EMAIL}`);
  console.log(`[iPOS Microservice] Password: ${IPOS_PASSWORD ? '***configured***' : 'NOT SET'}`);
});
