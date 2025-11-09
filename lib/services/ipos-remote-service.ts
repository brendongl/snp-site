// lib/services/ipos-remote-service.ts
// Client for iPOS Microservice (deployed on Render/fly.io)
// This is a browser-free solution that works on Railway

interface IPOSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  currentCustomers: number;
  lastUpdated: string;
}

const IPOS_MICROSERVICE_URL = process.env.IPOS_MICROSERVICE_URL ||
  'https://ipos-microservice.onrender.com'; // Update this after deploying

class IPOSRemoteService {
  private static instance: IPOSRemoteService;
  private cachedData: IPOSDashboardData | null = null;
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (microservice has its own 5-min cache)

  private constructor() {}

  static getInstance(): IPOSRemoteService {
    if (!IPOSRemoteService.instance) {
      IPOSRemoteService.instance = new IPOSRemoteService();
    }
    return IPOSRemoteService.instance;
  }

  async getDashboardData(): Promise<IPOSDashboardData> {
    // Return cached data if still valid
    const now = Date.now();
    if (this.cachedData && now - this.cacheTimestamp < this.CACHE_DURATION) {
      console.log('[iPOS Remote] Returning locally cached data');
      return this.cachedData;
    }

    try {
      console.log('[iPOS Remote] Fetching from microservice:', IPOS_MICROSERVICE_URL);

      const response = await fetch(`${IPOS_MICROSERVICE_URL}/ipos-dashboard`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Timeout after 30 seconds (first request can be slow)
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error || 'Unknown error from microservice');
      }

      const data = json.data;

      // Update cache
      this.cachedData = data;
      this.cacheTimestamp = now;

      console.log('[iPOS Remote] ✅ Successfully fetched data:', data);
      return data;

    } catch (error) {
      console.error('[iPOS Remote] Error fetching from microservice:', error);

      // Return stale cache if available
      if (this.cachedData) {
        console.warn('[iPOS Remote] Returning stale cached data due to error');
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
   * Check if microservice is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${IPOS_MICROSERVICE_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (error) {
      console.error('[iPOS Remote] Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const iposRemote = IPOSRemoteService.getInstance();
