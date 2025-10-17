// Custom fetch configuration for Docker environments
// Forces IPv4 and sets appropriate timeouts

export function createFetchWithTimeout(timeoutMs: number = 30000) {
  return async (url: string | URL | Request, init?: RequestInit) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        // @ts-ignore - Node.js specific options
        family: 4, // Force IPv4
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const fetchWithTimeout = createFetchWithTimeout();
