// lib/services/ipos-auth-service.ts
// iPOS authentication service with hardcoded access_token
//
// FINDINGS FROM INVESTIGATION (Nov 9, 2025):
// 1. access_token is HARDCODED in frontend JavaScript (5c885b2ef8c34fb7b1d1fad11eef7bec)
// 2. authorization JWT must be obtained via browser-based login (cannot be automated)
// 3. Both tokens are required for API calls to posapi.ipos.vn
// 4. Recommended approach: Use scripts/get-ipos-access-token.js to capture tokens manually
//
// See docs/IPOS_DIRECT_API_GUIDE.md for full investigation results

interface TokenCache {
  accessToken: string;
  authToken: string;
  cachedAt: number;
}

class IPOSAuthService {
  private static instance: IPOSAuthService;
  private tokenCache: TokenCache | null = null;

  // HARDCODED access_token discovered in frontend JavaScript
  // Source: /js/app.6e46e37ccb62a9070723.js on fabi.ipos.vn
  // This is a static token shared by all users
  private readonly HARDCODED_ACCESS_TOKEN = '5c885b2ef8c34fb7b1d1fad11eef7bec';

  private constructor() {
    // In-memory cache only, no filesystem access
  }

  static getInstance(): IPOSAuthService {
    if (!IPOSAuthService.instance) {
      IPOSAuthService.instance = new IPOSAuthService();
    }
    return IPOSAuthService.instance;
  }

  async getTokens(): Promise<{ accessToken: string; authToken: string } | null> {
    // Check if we have valid cached tokens
    if (this.tokenCache) {
      console.log('[iPOS Auth] Using cached tokens');
      return {
        accessToken: this.tokenCache.accessToken,
        authToken: this.tokenCache.authToken
      };
    }

    // Try to get authorization JWT from environment variable
    const envAuthToken = process.env.IPOS_AUTH_TOKEN;

    if (!envAuthToken) {
      console.error('[iPOS Auth] IPOS_AUTH_TOKEN not found in environment variables');
      console.error('[iPOS Auth] Please run: node scripts/get-ipos-access-token.js');
      console.error('[iPOS Auth] Then add IPOS_AUTH_TOKEN to your .env file');
      return null;
    }

    // Use hardcoded access_token + environment auth token
    console.log('[iPOS Auth] Using hardcoded access_token + environment auth token');

    this.tokenCache = {
      accessToken: this.HARDCODED_ACCESS_TOKEN,
      authToken: envAuthToken,
      cachedAt: Date.now()
    };

    return {
      accessToken: this.HARDCODED_ACCESS_TOKEN,
      authToken: envAuthToken
    };
  }

  // Clear cache (useful if token expires and needs refresh)
  clearCache(): void {
    console.log('[iPOS Auth] Clearing token cache');
    this.tokenCache = null;
  }

  // Check if tokens are cached
  isAuthenticated(): boolean {
    return this.tokenCache !== null;
  }
}

// Export singleton instance
export const iposAuth = IPOSAuthService.getInstance();