import { BGGGameData } from '@/types';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '@/lib/logger';

const BGG_API_BASE = 'https://boardgamegeek.com/xmlapi2';
const RATE_LIMIT_MS = 5000; // 5 seconds between requests as per BGG guidelines

let lastRequestTime = 0;

/**
 * Rate limit BGG API requests
 */
async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${waitTime}ms before next BGG API request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Scrape images directly from BoardGameGeek game page
 * This gets images from the BGG image gallery
 */
async function scrapeBGGPageImages(gameId: number): Promise<string[]> {
  try {
    const pageUrl = `https://boardgamegeek.com/boardgame/${gameId}`;
    logger.info('BGG API', `Scraping images from BGG page: ${pageUrl}`, { gameId });

    const response = await fetch(pageUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      logger.warn('BGG API', `Failed to fetch BGG page: ${response.status}`, { gameId });
      return [];
    }

    const html = await response.text();
    const images: string[] = [];

    // Look for image URLs in the HTML
    // BGG uses cf.geekdo-images.com for their image CDN
    const imageRegex = /https:\/\/cf\.geekdo-images\.com\/[^"'\s]+\/(pic\d+\.(?:jpg|png))/g;
    const matches = html.matchAll(imageRegex);

    for (const match of matches) {
      const imageUrl = match[0];
      // Get the original/large version of the image
      const originalUrl = imageUrl.replace(/__\w+\/img\/[^/]+\//, '__original/img/').replace(/\/filters:.*?\//, '/');
      images.push(originalUrl);
    }

    // Deduplicate and limit
    const uniqueImages = Array.from(new Set(images)).slice(0, 15);
    logger.info('BGG API', `Found ${uniqueImages.length} images from BGG page scraping`, { gameId });

    return uniqueImages;

  } catch (error) {
    logger.error('BGG API', 'Error scraping BGG page images', error as Error, { gameId });
    return [];
  }
}

/**
 * Search for additional game images using free public APIs
 * Tries multiple sources with fallbacks
 */
async function scrapeGameImages(gameName: string, gameId: number): Promise<string[]> {
  try {
    // Try 1: Scrape directly from BGG game page (BEST source)
    const bggImages = await scrapeBGGPageImages(gameId);
    if (bggImages.length > 5) {
      logger.info('BGG API', `Using ${bggImages.length} images from BGG page`, { gameName, gameId });
      return bggImages;
    }

    logger.info('BGG API', `Only found ${bggImages.length} images from BGG, trying external sources...`, { gameName });

    // Try 2: DuckDuckGo Instant Answer API (free, no key needed)
    const searchQuery = `${gameName} board game`;
    logger.info('BGG API', `Searching for additional images: ${gameName}`, { searchQuery });

    try {
      const ddgResponse = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&t=boardgame`,
        { signal: AbortSignal.timeout(3000) }
      );

      if (ddgResponse.ok) {
        const ddgData = await ddgResponse.json();
        const images: string[] = [...bggImages]; // Start with BGG images

        // Extract images from RelatedTopics
        if (ddgData.RelatedTopics && Array.isArray(ddgData.RelatedTopics)) {
          ddgData.RelatedTopics.forEach((topic: any) => {
            if (topic.Icon?.URL) {
              const iconUrl = topic.Icon.URL;
              // Filter out small icons, PDFs, and DuckDuckGo's own icons
              if (
                iconUrl.includes('http') &&
                !iconUrl.includes('duckduckgo.com') &&
                !iconUrl.includes('assets') &&
                !iconUrl.toLowerCase().endsWith('.pdf') &&
                iconUrl.length > 50
              ) {
                images.push(iconUrl);
              }
            }
          });
        }

        if (images.length > bggImages.length) {
          const uniqueImages = Array.from(new Set(images)).slice(0, 15);
          logger.info('BGG API', `Found ${uniqueImages.length} total images (${bggImages.length} from BGG + ${uniqueImages.length - bggImages.length} from DuckDuckGo)`, { gameName });
          return uniqueImages;
        }
      }
    } catch (ddgError) {
      logger.debug('BGG API', 'DuckDuckGo lookup failed', {
        error: ddgError instanceof Error ? ddgError.message : 'Unknown error'
      });
    }

    // Return whatever BGG images we have
    if (bggImages.length > 0) {
      logger.info('BGG API', `Returning ${bggImages.length} images from BGG only`, { gameName });
      return bggImages;
    }

    // No images found at all
    logger.info('BGG API', 'No additional images found from any source', { gameName });
    return [];

  } catch (error) {
    logger.error('BGG API', 'Error searching for images', error as Error, { gameName });
    return [];
  }
}

export async function fetchBGGGame(gameId: number): Promise<BGGGameData> {
  await rateLimit();

  const url = `${BGG_API_BASE}/thing?id=${gameId}&stats=1`;

  logger.info('BGG API', `Fetching game data for ID: ${gameId}`, { url });

  try {
    const response = await fetch(url);

    logger.api('BGG API', 'API Response received',
      { url, method: 'GET' },
      { status: response.status }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('BGG API', `API returned status ${response.status}`, new Error(errorText), { gameId, status: response.status });
      throw new Error(`BGG API returned status ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const xmlText = await response.text();
    logger.debug('BGG API', 'XML Response received', {
      gameId,
      responseLength: xmlText.length,
      preview: xmlText.substring(0, 500)
    });

    // Parse XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    });

    const result = parser.parse(xmlText);

    if (!result.items || !result.items.item) {
      throw new Error('Invalid game ID or game not found');
    }

    const item = result.items.item;

    // Extract primary name
    const names = Array.isArray(item.name) ? item.name : [item.name];
    const primaryName = names.find((n: any) => n['@_type'] === 'primary');
    const gameName = primaryName ? primaryName['@_value'] : names[0]['@_value'];

    // Extract categories
    const links = Array.isArray(item.link) ? item.link : [item.link];
    const categories = links
      .filter((link: any) => link['@_type'] === 'boardgamecategory')
      .map((link: any) => link['@_value']);

    // Extract mechanisms
    const mechanisms = links
      .filter((link: any) => link['@_type'] === 'boardgamemechanic')
      .map((link: any) => link['@_value']);

    // Check if expansion
    const isExpansion = item['@_type'] === 'boardgameexpansion';

    // Get base game if expansion
    let expandsGameId: number | undefined;
    let expandsGameName: string | undefined;

    if (isExpansion) {
      const expandsLink = links.find((link: any) =>
        link['@_type'] === 'boardgameexpansion' && link['@_inbound'] === 'true'
      );
      if (expandsLink) {
        expandsGameId = parseInt(expandsLink['@_id']);
        expandsGameName = expandsLink['@_value'];
      }
    }

    // Extract best player count from poll
    let bestPlayerCount: number | undefined;
    if (item.poll) {
      const polls = Array.isArray(item.poll) ? item.poll : [item.poll];
      const playerPoll = polls.find((p: any) => p['@_name'] === 'suggested_numplayers');

      if (playerPoll && playerPoll.results) {
        const results = Array.isArray(playerPoll.results) ? playerPoll.results : [playerPoll.results];

        // Find player count with highest "Best" votes
        let maxBestVotes = 0;
        let bestCount = 0;

        results.forEach((result: any) => {
          const numPlayers = result['@_numplayers'];
          if (numPlayers && numPlayers !== '+') {
            const resultArray = Array.isArray(result.result) ? result.result : [result.result];
            const bestResult = resultArray.find((r: any) => r['@_value'] === 'Best');
            if (bestResult) {
              const votes = parseInt(bestResult['@_numvotes']) || 0;
              if (votes > maxBestVotes) {
                maxBestVotes = votes;
                bestCount = parseInt(numPlayers);
              }
            }
          }
        });

        if (bestCount > 0) {
          bestPlayerCount = Math.floor(bestCount); // Round down as requested
        }
      }
    }

    // Extract statistics - averageweight is in the 'value' attribute
    const stats = item.statistics?.ratings;
    const weightValue = stats?.averageweight?.['@_value'] || stats?.averageweight;
    const complexity = weightValue ? parseFloat(weightValue) : 0;

    // Get all images (thumbnail and full image)
    const allImages: string[] = [];
    if (item.image) allImages.push(item.image);
    if (item.thumbnail && item.thumbnail !== item.image) allImages.push(item.thumbnail);

    // Fetch additional images from BGG page and external sources
    const scrapedImages = await scrapeGameImages(gameName, gameId);
    allImages.push(...scrapedImages);

    // Deduplicate images
    const uniqueImages = Array.from(new Set(allImages));

    const gameData: BGGGameData = {
      id: gameId,
      name: gameName,
      description: item.description || '',
      yearPublished: item.yearpublished ? parseInt(item.yearpublished['@_value']) || 0 : 0,
      minPlayers: item.minplayers ? parseInt(item.minplayers['@_value']) || 0 : 0,
      maxPlayers: item.maxplayers ? parseInt(item.maxplayers['@_value']) || 0 : 0,
      bestPlayerCount,
      playingTime: item.playingtime ? parseInt(item.playingtime['@_value']) || 0 : 0,
      minAge: item.minage ? parseInt(item.minage['@_value']) || 0 : 0,
      complexity: Math.ceil(complexity), // Round UP as requested
      categories,
      mechanisms,
      imageUrl: item.image || '',
      thumbnailUrl: item.thumbnail || '',
      allImages: uniqueImages,
      isExpansion,
      expandsGameId,
      expandsGameName,
    };

    logger.info('BGG API', `Successfully fetched game: ${gameName}`, { gameId, name: gameName });
    return gameData;

  } catch (error) {
    logger.error('BGG API', `Failed to fetch game ${gameId}`, error as Error, { gameId });
    throw new Error(`Failed to fetch game data from BoardGameGeek: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for games by name
 */
export async function searchBGGGames(query: string): Promise<Array<{ id: number; name: string; yearPublished?: number }>> {
  await rateLimit();

  const url = `${BGG_API_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame,boardgameexpansion`;

  console.log(`Searching BGG for: ${query}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`BGG API returned status ${response.status}`);
    }

    const xmlText = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });

    const result = parser.parse(xmlText);

    if (!result.items || !result.items.item) {
      return [];
    }

    const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item];

    return items.map((item: any) => ({
      id: parseInt(item['@_id']),
      name: item.name?.['@_value'] || 'Unknown',
      yearPublished: item.yearpublished ? parseInt(item.yearpublished['@_value']) : undefined,
    }));

  } catch (error) {
    console.error('Error searching BGG:', error);
    throw new Error('Failed to search BoardGameGeek');
  }
}
