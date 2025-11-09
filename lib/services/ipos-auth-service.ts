// lib/services/ipos-auth-service.ts
// Automated iPOS authentication service
// Handles login and token refresh automatically
// Note: Uses in-memory cache only (no filesystem access for client compatibility)

interface TokenCache {
  accessToken: string;
  authToken: string;
  expiresAt: number;
  refreshAt: number; // Refresh 5 minutes before expiry
}

interface LoginResponse {
  access_token: string;
  authorization: string;
  expires_in?: number; // seconds until expiry
}

class IPOSAuthService {
  private static instance: IPOSAuthService;
  private tokenCache: TokenCache | null = null;
  private readonly email = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
  private readonly password = process.env.IPOS_PASSWORD || '123123A';
  private isRefreshing = false;

  private constructor() {
    // In-memory cache only, no filesystem access
  }

  static getInstance(): IPOSAuthService {
    if (!IPOSAuthService.instance) {
      IPOSAuthService.instance = new IPOSAuthService();
    }
    return IPOSAuthService.instance;
  }

  private async performLogin(): Promise<LoginResponse | null> {
    console.log('[iPOS Auth] Performing login...');

    try {
      // Step 1: Get initial page and extract any required tokens/cookies
      const loginPageResponse = await fetch('https://fabi.ipos.vn/login', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'manual'
      });

      // Extract cookies from login page
      const cookies = loginPageResponse.headers.get('set-cookie') || '';

      // Step 2: Perform login
      const loginResponse = await fetch('https://posapi.ipos.vn/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://fabi.ipos.vn',
          'Referer': 'https://fabi.ipos.vn/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          remember_me: true
        })
      });

      if (!loginResponse.ok) {
        console.error('[iPOS Auth] Login failed:', loginResponse.status, loginResponse.statusText);
        const errorText = await loginResponse.text();
        console.error('[iPOS Auth] Error response:', errorText.substring(0, 500));
        return null;
      }

      const loginData = await loginResponse.json();
      console.log('[iPOS Auth] Login response received');

      // Extract tokens from response
      // The response structure might vary, we need to handle different formats
      let accessToken: string | undefined;
      let authToken: string | undefined;

      // Check various possible response formats
      if (loginData.access_token) {
        accessToken = loginData.access_token;
      } else if (loginData.data?.access_token) {
        accessToken = loginData.data.access_token;
      }

      if (loginData.authorization) {
        authToken = loginData.authorization;
      } else if (loginData.token) {
        authToken = loginData.token;
      } else if (loginData.data?.token) {
        authToken = loginData.data.token;
      } else if (loginData.jwt) {
        authToken = loginData.jwt;
      } else if (loginData.data?.jwt) {
        authToken = loginData.data.jwt;
      }

      // If we don't have explicit tokens, check headers
      if (!accessToken || !authToken) {
        // Try alternate approach - check if login returns session info
        const sessionResponse = await fetch('https://posapi.ipos.vn/api/v1/auth/session', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Referer': 'https://fabi.ipos.vn/',
            'Cookie': cookies
          }
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          accessToken = sessionData.access_token || sessionData.data?.access_token;
          authToken = sessionData.authorization || sessionData.token || sessionData.data?.token;
        }
      }

      if (!accessToken || !authToken) {
        console.error('[iPOS Auth] Could not extract tokens from login response');
        console.log('[iPOS Auth] Response structure:', JSON.stringify(loginData, null, 2).substring(0, 1000));
        return null;
      }

      return {
        access_token: accessToken,
        authorization: authToken,
        expires_in: loginData.expires_in || 3600 // Default to 1 hour if not provided
      };

    } catch (error) {
      console.error('[iPOS Auth] Login error:', error);
      return null;
    }
  }

  async getTokens(): Promise<{ accessToken: string; authToken: string } | null> {
    // Check if we have valid cached tokens
    if (this.tokenCache && Date.now() < this.tokenCache.refreshAt) {
      console.log('[iPOS Auth] Using cached tokens');
      return {
        accessToken: this.tokenCache.accessToken,
        authToken: this.tokenCache.authToken
      };
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      console.log('[iPOS Auth] Token refresh already in progress, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.getTokens(); // Retry after waiting
    }

    this.isRefreshing = true;

    try {
      // Check for environment variable tokens first (fallback)
      const envAccessToken = process.env.IPOS_ACCESS_TOKEN;
      const envAuthToken = process.env.IPOS_AUTH_TOKEN;

      if (envAccessToken && envAuthToken) {
        console.log('[iPOS Auth] Using tokens from environment variables');
        // Cache them with a reasonable expiry
        const expiresAt = Date.now() + (3600 * 1000); // 1 hour
        const refreshAt = Date.now() + (3300 * 1000); // 55 minutes

        this.tokenCache = {
          accessToken: envAccessToken,
          authToken: envAuthToken,
          expiresAt,
          refreshAt
        };

        console.log('[iPOS Auth] Tokens cached until:', new Date(expiresAt).toISOString());
        return {
          accessToken: envAccessToken,
          authToken: envAuthToken
        };
      }

      // Perform login to get fresh tokens
      console.log('[iPOS Auth] Refreshing tokens via login...');
      const loginResult = await this.performLogin();

      if (!loginResult) {
        console.error('[iPOS Auth] Failed to obtain tokens');
        return null;
      }

      // Calculate expiry times
      const expiresIn = loginResult.expires_in || 3600; // Default 1 hour
      const expiresAt = Date.now() + (expiresIn * 1000);
      const refreshAt = Date.now() + ((expiresIn - 300) * 1000); // Refresh 5 min before expiry

      // Cache the tokens
      this.tokenCache = {
        accessToken: loginResult.access_token,
        authToken: loginResult.authorization,
        expiresAt,
        refreshAt
      };

      console.log('[iPOS Auth] Tokens refreshed successfully');
      return {
        accessToken: loginResult.access_token,
        authToken: loginResult.authorization
      };

    } finally {
      this.isRefreshing = false;
    }
  }

  // Force refresh tokens (useful for testing or manual refresh)
  async forceRefresh(): Promise<{ accessToken: string; authToken: string } | null> {
    console.log('[iPOS Auth] Force refreshing tokens...');
    this.tokenCache = null; // Clear cache
    return this.getTokens();
  }

  // Check if tokens are valid
  isAuthenticated(): boolean {
    return this.tokenCache !== null && Date.now() < this.tokenCache.expiresAt;
  }
}

// Export singleton instance
export const iposAuth = IPOSAuthService.getInstance();