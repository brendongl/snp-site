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
  paidCustomers: number;      // Customers who have paid (from entry ticket sales)
  unpaidCustomers: number;    // Customers currently in store (from sale tracking)
  lastUpdated: string;
}

// Entry ticket item IDs that count as customers
const ENTRY_TICKET_IDS = [
  'ITEM-LA52',   // DND ENTRY Ticket
  'ITEM-I7J7',   // Entry Only
  'ITEM-H548',   // PR Entry Only
  'COMBO-7NKN',  // PR Snacks + Soft-Drinks Ticket
  'COMBO-I4H7',  // 6-Day Pass Entry
  'COMBO-MZE3',  // Entry Combo
  'COMBO-O9KY',  // PR Unlimited Beer Tower Ticket
  'COMBO-VH77',  // Friday Promo 2pax Entry Combo (counts as 2!)
  'COMBO-XHUW'   // PR Entry w/ Drink
];

// Store UIDs
const BRAND_UID = '32774afe-fd5c-4028-b837-f91837c0307c';
const COMPANY_UID = '8a508e04-440f-4145-9429-22b7696c6193';
const STORE_UID = '72a800a6-1719-4b4b-9065-31ab2e0c07e5';
const STORE_OPEN_AT = 10; // 10 AM

let cachedData: IPOSDashboardData | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get today's date range (from store opening time to now)
 */
function getTodayDateRange(): { start_date: number; end_date: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), STORE_OPEN_AT, 0, 0);

  return {
    start_date: today.getTime(),
    end_date: now.getTime()
  };
}

/**
 * Fetch dashboard data from iPOS using Playwright
 * - Logs in and captures auth tokens
 * - Calls items API to count paid customers (from entry ticket sales)
 * - Scrapes sale tracking page to count unpaid customers
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
    // Launch headless browser with Railway/Docker-optimized flags
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',           // Required for Docker environments
        '--disable-dev-shm-usage', // Use /tmp instead of /dev/shm for shared memory
      ]
    });
    page = await browser.newPage();

    // Capture authentication tokens from API responses
    let accessToken = '';
    let authToken = '';

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('posapi.ipos.vn')) {
        const headers = response.request().headers();
        if (headers['access_token']) accessToken = headers['access_token'];
        if (headers['authorization']) authToken = headers['authorization'];
      }
    });

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
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Check if we captured tokens
    if (!accessToken || !authToken) {
      throw new Error('Failed to capture authentication tokens');
    }

    console.log('[iPOS] Successfully captured auth tokens');

    // ===================================================
    // STEP 1: Extract dashboard data (revenue, tables, unpaid amount)
    // ===================================================
    const dashboardData = await page.evaluate(() => {
      const textContent = document.body.innerText;
      const lines = textContent.split('\n');

      // Extract unpaid amount
      let unpaidAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Hiện tại ở quán')) {
          if (i + 1 < lines.length) {
            const match = lines[i + 1].match(/([\d,]+)\s*₫?/);
            if (match) {
              unpaidAmount = parseFloat(match[1].replace(/,/g, ''));
            }
          }
          break;
        }
      }

      // Extract paid amount
      let paidAmount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Doanh thu (NET)')) {
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

      return {
        unpaidAmount,
        paidAmount,
        currentTables
      };
    });

    console.log('[iPOS] Dashboard data:', dashboardData);

    // ===================================================
    // STEP 2: Fetch item sales to count PAID customers
    // ===================================================
    const dateRange = getTodayDateRange();
    const params = new URLSearchParams({
      brand_uid: BRAND_UID,
      company_uid: COMPANY_UID,
      list_store_uid: STORE_UID,
      start_date: dateRange.start_date.toString(),
      end_date: dateRange.end_date.toString(),
      store_open_at: STORE_OPEN_AT.toString(),
      limit: '100',
      order_by: 'revenue_net'
    });

    const itemsUrl = `https://posapi.ipos.vn/api/v1/reports/sale-summary/items?${params}`;

    console.log('[iPOS] Fetching item sales...');

    const itemsResponse = await fetch(itemsUrl, {
      headers: {
        'access_token': accessToken,
        'authorization': authToken,
        'fabi_type': 'pos-cms',
        'x-client-timezone': '25200000',
        'accept-language': 'vi',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!itemsResponse.ok) {
      throw new Error(`Items API error: ${itemsResponse.status}`);
    }

    const itemsData = await itemsResponse.json();
    const items = itemsData.data?.list_data_item_return || [];

    // Count paid customers from entry tickets
    let paidCustomers = 0;
    for (const item of items) {
      if (ENTRY_TICKET_IDS.includes(item.item_id)) {
        // Friday Promo 2pax counts as 2 people
        if (item.item_id === 'COMBO-VH77') {
          paidCustomers += Math.round(item.quantity_sold) * 2;
        } else {
          paidCustomers += Math.round(item.quantity_sold);
        }
      }
    }

    console.log('[iPOS] Paid customers from entry tickets:', paidCustomers);

    // ===================================================
    // STEP 3: Scrape sale tracking page for UNPAID customers
    // ===================================================
    console.log('[iPOS] Navigating to sale tracking page...');
    await page.goto('https://fabi.ipos.vn/sale-tracking', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const unpaidCustomers = await page.evaluate((entryTicketIds) => {
      let totalCustomers = 0;

      // Find all table cards or rows
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n');

      // Look for entry ticket names in the sale tracking page
      // This counts how many entry tickets are on unpaid bills
      for (const line of lines) {
        // Check if line contains entry ticket names
        if (line.includes('Entry Combo') ||
            line.includes('Entry Only') ||
            line.includes('DND ENTRY') ||
            line.includes('PR Entry') ||
            line.includes('6-Day Pass') ||
            line.includes('Friday Promo 2pax')) {

          // Try to extract quantity
          const qtyMatch = line.match(/x\s*(\d+)/i) || line.match(/(\d+)\s*x/i);
          const quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

          // Check if it's the Friday 2pax promo (counts as 2)
          if (line.includes('Friday Promo 2pax')) {
            totalCustomers += quantity * 2;
          } else {
            totalCustomers += quantity;
          }
        }
      }

      return totalCustomers;
    }, ENTRY_TICKET_IDS);

    console.log('[iPOS] Unpaid customers from sale tracking:', unpaidCustomers);

    // ===================================================
    // STEP 4: Combine all data
    // ===================================================
    const result: IPOSDashboardData = {
      unpaidAmount: dashboardData.unpaidAmount,
      paidAmount: dashboardData.paidAmount,
      currentTables: dashboardData.currentTables,
      paidCustomers,
      unpaidCustomers,
      lastUpdated: new Date().toISOString()
    };

    // Cache the result
    cachedData = result;
    cacheTimestamp = now;

    console.log('[iPOS] Successfully fetched complete data:', result);

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
      paidCustomers: 0,
      unpaidCustomers: 0,
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
