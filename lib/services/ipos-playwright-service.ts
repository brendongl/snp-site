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

    // Wait for dashboard to load - increase timeout and add extra wait for data
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });

    // Additional wait for all data to load properly
    await page.waitForTimeout(3000);

    // Extract data from the dashboard
    const data = await page.evaluate(() => {
      const textContent = document.body.innerText;
      const lines = textContent.split('\n');

      // Extract unpaid amount (from "Hiện tại ở quán" section)
      let unpaidAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Hiện tại ở quán')) {
          // The amount is on the next line
          if (i + 1 < lines.length) {
            const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
            if (match) {
              unpaidAmount = parseFloat(match[1].replace(/,/g, ''));
            }
          }
          break;
        }
      }

      // Extract paid/revenue amount (from "Doanh thu (NET)" section)
      let paidAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Doanh thu (NET)')) {
          // The amount is on the next line
          if (i + 1 < lines.length) {
            const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
            if (match) {
              paidAmount = parseFloat(match[1].replace(/,/g, ''));
            }
          }
          break;
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
