// lib/services/ipos-session-service.ts
// iPOS API Service using Playwright to maintain browser session
//
// KEY INSIGHT: Tokens are session-bound!
// - Extracting tokens and using them elsewhere → 401 Unauthorized
// - Maintaining browser session and making API calls within it → Works!
//
// This service:
// 1. Logs into fabi.ipos.vn via Playwright
// 2. Maintains the browser session
// 3. Intercepts API responses to extract data
// 4. Caches data for 5 minutes
// 5. Automatically refreshes session if it expires

import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface IPOSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  currentCustomers: number;
  lastUpdated: string;
}

class IPOSSessionService {
  private static instance: IPOSSessionService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionActive = false;

  // Caching
  private cachedData: IPOSDashboardData | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Configuration
  private readonly IPOS_EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
  private readonly IPOS_PASSWORD = process.env.IPOS_PASSWORD || '';
  private readonly BRAND_UID = '32774afe-fd5c-4028-b837-f91837c0307c';
  private readonly COMPANY_UID = '8a508e04-440f-4145-9429-22b7696c6193';
  private readonly STORE_UID = '72a800a6-1719-4b4b-9065-31ab2e0c07e5';
  private readonly STORE_OPEN_HOUR = 10;

  private constructor() {
    if (!this.IPOS_PASSWORD) {
      console.warn('[iPOS Session] IPOS_PASSWORD not set in environment');
    }
  }

  static getInstance(): IPOSSessionService {
    if (!IPOSSessionService.instance) {
      IPOSSessionService.instance = new IPOSSessionService();
    }
    return IPOSSessionService.instance;
  }

  /**
   * Initialize browser session and login
   */
  private async initSession(): Promise<void> {
    console.log('[iPOS Session] Initializing browser session...');

    try {
      // Launch browser (headless in production)
      this.browser = await chromium.launch({
        headless: process.env.NODE_ENV === 'production',
        timeout: 30000,
      });

      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();

      // Navigate to login page
      console.log('[iPOS Session] Navigating to login page...');
      await this.page.goto('https://fabi.ipos.vn/login', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Fill in credentials
      console.log('[iPOS Session] Filling in credentials...');
      await this.page.fill('input[name="email_input"]', this.IPOS_EMAIL);
      await this.page.fill('input[type="password"]', this.IPOS_PASSWORD);

      // Click login and wait for navigation
      console.log('[iPOS Session] Logging in...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        this.page.click('button:has-text("Đăng nhập")'),
      ]);

      // Wait for dashboard to load
      console.log('[iPOS Session] Waiting for dashboard...');
      await this.page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });

      // Wait for initial API calls to complete
      await this.page.waitForTimeout(3000);

      this.sessionActive = true;
      console.log('[iPOS Session] ✅ Session initialized successfully');
    } catch (error) {
      console.error('[iPOS Session] Failed to initialize session:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Cleanup browser resources
   */
  private async cleanup(): Promise<void> {
    console.log('[iPOS Session] Cleaning up browser resources...');
    this.sessionActive = false;

    try {
      if (this.page) await this.page.close().catch(() => {});
      if (this.context) await this.context.close().catch(() => {});
      if (this.browser) await this.browser.close().catch(() => {});
    } catch (error) {
      console.error('[iPOS Session] Error during cleanup:', error);
    }

    this.page = null;
    this.context = null;
    this.browser = null;
  }

  /**
   * Get store opening timestamp for a given date
   */
  private getStoreOpeningTimestamp(date: Date): number {
    const d = new Date(date);
    d.setHours(this.STORE_OPEN_HOUR, 0, 0, 0);
    return d.getTime();
  }

  /**
   * Fetch dashboard data by intercepting API response
   */
  async getDashboardData(): Promise<IPOSDashboardData> {
    // Return cached data if still valid
    const now = Date.now();
    if (this.cachedData && now - this.cacheTimestamp < this.CACHE_DURATION) {
      console.log('[iPOS Session] Returning cached data');
      return this.cachedData;
    }

    console.log('[iPOS Session] Fetching fresh data...');

    try {
      // Initialize session if not active
      if (!this.sessionActive || !this.page) {
        await this.initSession();
      }

      // Set up response listener to capture API data
      const apiDataPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for API response'));
        }, 15000);

        const responseHandler = async (response: any) => {
          if (response.url().includes('sale-summary/overview')) {
            console.log('[iPOS Session] 🎯 Captured API call:', response.url());
            console.log('[iPOS Session] Status:', response.status());

            if (response.status() === 200) {
              try {
                const data = await response.json();
                clearTimeout(timeout);
                this.page?.off('response', responseHandler);
                resolve(data);
              } catch (error) {
                console.error('[iPOS Session] Error parsing API response:', error);
              }
            } else if (response.status() === 401) {
              // Session expired, need to re-login
              console.warn('[iPOS Session] Session expired (401), re-initializing...');
              clearTimeout(timeout);
              this.page?.off('response', responseHandler);
              this.sessionActive = false;
              reject(new Error('Session expired'));
            }
          }
        };

        this.page?.on('response', responseHandler);
      });

      // Trigger a page reload to generate API call
      console.log('[iPOS Session] Reloading dashboard to trigger API call...');
      await this.page!.reload({ waitUntil: 'networkidle' });
      await this.page!.waitForTimeout(2000);

      // Wait for API data
      const apiResponse = await apiDataPromise;

      // Extract dashboard data from API response
      const data = apiResponse.data || {};
      const saleTracking = data.sale_tracking || {};

      const dashboardData: IPOSDashboardData = {
        unpaidAmount: saleTracking.total_amount || 0,
        paidAmount: data.revenue_net || 0,
        currentTables: saleTracking.table_count || 0,
        currentCustomers: saleTracking.people_count || 0,
        lastUpdated: new Date().toISOString(),
      };

      // Update cache
      this.cachedData = dashboardData;
      this.cacheTimestamp = now;

      console.log('[iPOS Session] ✅ Successfully fetched data:', dashboardData);
      return dashboardData;
    } catch (error) {
      console.error('[iPOS Session] Error fetching data:', error);

      // If session expired, try once more with fresh session
      if (error instanceof Error && error.message.includes('Session expired')) {
        console.log('[iPOS Session] Retrying with fresh session...');
        await this.cleanup();
        return this.getDashboardData(); // Recursive retry
      }

      // Return cached data if available (even if stale)
      if (this.cachedData) {
        console.warn('[iPOS Session] Returning stale cached data due to error');
        return this.cachedData;
      }

      // Return zeros if no cached data
      return {
        unpaidAmount: 0,
        paidAmount: 0,
        currentTables: 0,
        currentCustomers: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Manually close the session (for cleanup)
   */
  async closeSession(): Promise<void> {
    await this.cleanup();
  }
}

// Export singleton instance
export const iposSession = IPOSSessionService.getInstance();
