// lib/services/ipos-playwright-service.ts
// Server-side iPOS authentication using Playwright
// Handles login and data fetching since direct API calls don't work

import { chromium, Browser, Page } from 'playwright';

interface IPOSCredentials {
  email: string;
  password: string;
}

interface IPOSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  currentCustomers: number;
  lastUpdated: string;
}

let cachedData: IPOSDashboardData | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch dashboard data from iPOS using Playwright
 * Logs in, extracts data from the dashboard, and caches it
 */
export async function fetchIPOSDashboardData(
  credentials: IPOSCredentials
): Promise<IPOSDashboardData> {
  // Return cached data if still valid
  const now = Date.now();
  if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('[iPOS] Returning cached data');
    return cachedData;
  }

  console.log('[iPOS] Fetching fresh data via Playwright');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Launch headless browser
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Navigate to login page
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });

    // Fill in credentials
    await page.fill('input[name="email_input"]', credentials.email);
    await page.fill('input[type="password"]', credentials.password);

    // Click login and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    // Wait for dashboard to load
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 10000 });

    // Extract data from the dashboard
    const data = await page.evaluate(() => {
      // Extract unpaid amount (from "Hiện tại ở quán" section)
      const unpaidText = document.body.innerText.match(/Tổng tiền chưa thanh toán\s+([\d,]+)/);
      const unpaidAmount = unpaidText ? parseFloat(unpaidText[1].replace(/,/g, '')) : 0;

      // Extract paid/revenue amount (from "Doanh thu (NET)" section)
      const revenueElements = document.querySelectorAll('div');
      let paidAmount = 0;
      for (const el of revenueElements) {
        const text = el.textContent || '';
        // Look for pattern like "723,587 ₫" after "Doanh thu (NET)"
        const match = text.match(/([\d,]+)\s*₫/);
        if (match && !text.includes('Trung bình') && !text.includes('Giảm')) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (amount > 0 && amount < 1000000000) { // Reasonable range
            paidAmount = amount;
            break;
          }
        }
      }

      // Extract table count
      const tableText = document.body.innerText.match(/Có\s+(\d+)\s+bàn\s+\/\s+(\d+)\s+bàn/);
      const currentTables = tableText ? parseInt(tableText[1]) : 0;

      // Extract customer count
      const customerText = document.body.innerText.match(/Tổng:\s+(\d+)\s+khách/);
      const currentCustomers = customerText ? parseInt(customerText[1]) : 0;

      return {
        unpaidAmount,
        paidAmount,
        currentTables,
        currentCustomers
      };
    });

    const result: IPOSDashboardData = {
      ...data,
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    cachedData = result;
    cacheTimestamp = now;

    console.log('[iPOS] Successfully fetched data:', result);

    return result;

  } catch (error) {
    console.error('[iPOS] Error fetching dashboard data:', error);

    // Return cached data if available, even if stale
    if (cachedData) {
      console.log('[iPOS] Returning stale cached data due to error');
      return cachedData;
    }

    // Return zeros if no cached data
    return {
      unpaidAmount: 0,
      paidAmount: 0,
      currentTables: 0,
      currentCustomers: 0,
      lastUpdated: new Date().toISOString()
    };

  } finally {
    // Clean up
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Get default credentials from environment
 */
export function getIPOSCredentials(): IPOSCredentials | null {
  const email = process.env.IPOS_EMAIL;
  const password = process.env.IPOS_PASSWORD;

  if (!email || !password) {
    console.warn('[iPOS] Credentials not configured in environment');
    return null;
  }

  return { email, password };
}
