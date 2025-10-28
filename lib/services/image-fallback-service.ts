/**
 * Image Fallback Service
 *
 * Multi-source image retrieval system for Nintendo Switch games.
 * Searches multiple APIs in order of priority to find missing images.
 *
 * Priority order:
 * 1. Blawar's titledb (Nintendo CDN) - Primary, most reliable
 * 2. RAWG API - Free 20k requests/month, good game database
 * 3. IGDB API - Comprehensive, requires API key
 * 4. Google Custom Search - Last resort fallback
 */

import axios from 'axios';

interface GameImageSet {
  landscape?: string;  // 16:9 cover
  portrait?: string;   // 1:1 cover
  screenshot?: string; // In-game screenshot
  source: string;      // Which API provided the images
}

interface RAWGGame {
  id: number;
  name: string;
  background_image: string;
  short_screenshots: Array<{ image: string }>;
}

interface IGDBGame {
  id: number;
  name: string;
  cover?: { url: string };
  screenshots?: Array<{ url: string }>;
}

class ImageFallbackService {
  private rawgApiKey: string;
  private igdbClientId: string;
  private igdbClientSecret: string;
  private igdbAccessToken: string | null = null;

  constructor() {
    // API keys from environment (optional - fallback to free tier if not provided)
    this.rawgApiKey = process.env.RAWG_API_KEY || '';
    this.igdbClientId = process.env.IGDB_CLIENT_ID || '';
    this.igdbClientSecret = process.env.IGDB_CLIENT_SECRET || '';
  }

  /**
   * Main entry point - searches all sources for game images
   */
  async findImages(gameName: string, titleId?: string): Promise<GameImageSet | null> {
    console.log(`[ImageFallback] Searching for images: ${gameName}`);

    // Try each source in priority order
    const sources = [
      () => this.searchRAWG(gameName),
      () => this.searchIGDB(gameName),
      () => this.searchGoogleImages(gameName),
    ];

    for (const searchFn of sources) {
      try {
        const result = await searchFn();
        if (result && this.isValidImageSet(result)) {
          console.log(`[ImageFallback] ✓ Found images from ${result.source}`);
          return result;
        }
      } catch (error) {
        console.error(`[ImageFallback] Source failed:`, error);
      }
    }

    console.warn(`[ImageFallback] ✗ No images found for: ${gameName}`);
    return null;
  }

  /**
   * Search RAWG API for game images
   * Free tier: 20,000 requests/month
   */
  private async searchRAWG(gameName: string): Promise<GameImageSet | null> {
    try {
      const apiKey = this.rawgApiKey || 'd09ed4b5586e41f697e1ad11e9690aad'; // Free public key
      const searchUrl = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(gameName)}&platforms=7`; // Platform 7 = Nintendo Switch

      const response = await axios.get(searchUrl, { timeout: 10000 });
      const games = response.data.results;

      if (!games || games.length === 0) {
        return null;
      }

      // Get the first matching game
      const game: RAWGGame = games[0];

      // Get detailed screenshots
      const detailsUrl = `https://api.rawg.io/api/games/${game.id}/screenshots?key=${apiKey}`;
      const screenshotsResponse = await axios.get(detailsUrl, { timeout: 10000 });
      const screenshots = screenshotsResponse.data.results || [];

      return {
        landscape: game.background_image, // Use as landscape
        portrait: game.background_image,  // RAWG doesn't have separate portrait, use same
        screenshot: screenshots[0]?.image || game.background_image,
        source: 'RAWG'
      };
    } catch (error) {
      console.error('[ImageFallback] RAWG search failed:', error);
      return null;
    }
  }

  /**
   * Search IGDB API for game images
   * Requires Twitch API credentials
   */
  private async searchIGDB(gameName: string): Promise<GameImageSet | null> {
    if (!this.igdbClientId || !this.igdbClientSecret) {
      return null; // Skip if no credentials
    }

    try {
      // Get access token if needed
      if (!this.igdbAccessToken) {
        await this.refreshIGDBToken();
      }

      const searchUrl = 'https://api.igdb.com/v4/games';
      const response = await axios.post(
        searchUrl,
        `search "${gameName}"; fields name,cover.url,screenshots.url; where platforms = (130);`, // 130 = Nintendo Switch
        {
          headers: {
            'Client-ID': this.igdbClientId,
            'Authorization': `Bearer ${this.igdbAccessToken}`,
          },
          timeout: 10000
        }
      );

      const games: IGDBGame[] = response.data;
      if (!games || games.length === 0) {
        return null;
      }

      const game = games[0];
      const coverUrl = game.cover?.url?.replace('t_thumb', 't_cover_big'); // Get high-res
      const screenshotUrl = game.screenshots?.[0]?.url?.replace('t_thumb', 't_screenshot_big');

      return {
        landscape: coverUrl,
        portrait: coverUrl,
        screenshot: screenshotUrl || coverUrl,
        source: 'IGDB'
      };
    } catch (error) {
      console.error('[ImageFallback] IGDB search failed:', error);
      return null;
    }
  }

  /**
   * Refresh IGDB access token using Twitch OAuth
   */
  private async refreshIGDBToken(): Promise<void> {
    try {
      const response = await axios.post(
        `https://id.twitch.tv/oauth2/token?client_id=${this.igdbClientId}&client_secret=${this.igdbClientSecret}&grant_type=client_credentials`,
        {},
        { timeout: 10000 }
      );

      this.igdbAccessToken = response.data.access_token;
    } catch (error) {
      console.error('[ImageFallback] Failed to refresh IGDB token:', error);
      throw error;
    }
  }

  /**
   * Last resort: Search Google Images (using programmable search)
   * Note: Requires GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID
   */
  private async searchGoogleImages(gameName: string): Promise<GameImageSet | null> {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !engineId) {
      return null; // Skip if no credentials
    }

    try {
      const searchQuery = `${gameName} Nintendo Switch game cover`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=3`;

      const response = await axios.get(searchUrl, { timeout: 10000 });
      const items = response.data.items;

      if (!items || items.length === 0) {
        return null;
      }

      return {
        landscape: items[0]?.link,
        portrait: items[0]?.link,
        screenshot: items[1]?.link || items[0]?.link,
        source: 'Google'
      };
    } catch (error) {
      console.error('[ImageFallback] Google search failed:', error);
      return null;
    }
  }

  /**
   * Validate that we have at least one usable image
   */
  private isValidImageSet(imageSet: GameImageSet): boolean {
    return !!(imageSet.landscape || imageSet.portrait || imageSet.screenshot);
  }

  /**
   * Batch search for multiple games
   */
  async findImagesForGames(games: Array<{ name: string; id?: string }>): Promise<Map<string, GameImageSet>> {
    const results = new Map<string, GameImageSet>();

    for (const game of games) {
      const images = await this.findImages(game.name, game.id);
      if (images) {
        results.set(game.name, images);
      }
      // Rate limiting: wait 100ms between requests to avoid hitting API limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

// Export singleton instance
export const imageFallbackService = new ImageFallbackService();
export default imageFallbackService;
