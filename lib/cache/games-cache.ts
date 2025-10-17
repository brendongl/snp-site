import fs from 'fs';
import path from 'path';
import { BoardGame, ContentCheck } from '@/types';

const CACHE_FILE = path.join(process.cwd(), 'data', 'games-cache.json');
const CONTENT_CHECKS_CACHE_FILE = path.join(process.cwd(), 'data', 'content-checks-cache.json');
const CACHE_DIR = path.join(process.cwd(), 'data');

interface CacheData {
  games: BoardGame[];
  lastUpdated: string;
}

interface ContentChecksCacheData {
  checks: ContentCheck[];
  lastUpdated: string;
}

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function getCachedGames(): BoardGame[] | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }

    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: CacheData = JSON.parse(data);
    return cache.games;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

export function setCachedGames(games: BoardGame[]): void {
  try {
    ensureCacheDir();

    const cache: CacheData = {
      games,
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing cache:', error);
    // Don't throw - allow app to continue without file cache
    // This is especially important in Docker environments with permission issues
  }
}

export function getCacheMetadata(): { lastUpdated: string | null; count: number } {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return { lastUpdated: null, count: 0 };
    }

    const data = fs.readFileSync(CACHE_FILE, 'utf-8');
    const cache: CacheData = JSON.parse(data);
    return {
      lastUpdated: cache.lastUpdated,
      count: cache.games.length
    };
  } catch (error) {
    console.error('Error reading cache metadata:', error);
    return { lastUpdated: null, count: 0 };
  }
}

// Content Checks Cache Functions

export function getCachedContentChecks(): ContentCheck[] | null {
  try {
    if (!fs.existsSync(CONTENT_CHECKS_CACHE_FILE)) {
      return null;
    }

    const data = fs.readFileSync(CONTENT_CHECKS_CACHE_FILE, 'utf-8');
    const cache: ContentChecksCacheData = JSON.parse(data);
    return cache.checks;
  } catch (error) {
    console.error('Error reading content checks cache:', error);
    return null;
  }
}

export function setCachedContentChecks(checks: ContentCheck[]): void {
  try {
    ensureCacheDir();

    const cache: ContentChecksCacheData = {
      checks,
      lastUpdated: new Date().toISOString()
    };

    fs.writeFileSync(CONTENT_CHECKS_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing content checks cache:', error);
    // Don't throw - allow app to continue without file cache
  }
}

export function getContentChecksCacheMetadata(): { lastUpdated: string | null; count: number } {
  try {
    if (!fs.existsSync(CONTENT_CHECKS_CACHE_FILE)) {
      return { lastUpdated: null, count: 0 };
    }

    const data = fs.readFileSync(CONTENT_CHECKS_CACHE_FILE, 'utf-8');
    const cache: ContentChecksCacheData = JSON.parse(data);
    return {
      lastUpdated: cache.lastUpdated,
      count: cache.checks.length
    };
  } catch (error) {
    console.error('Error reading content checks cache metadata:', error);
    return { lastUpdated: null, count: 0 };
  }
}

// Merge updated games with existing cache
export function mergeGamesIntoCache(updatedGames: BoardGame[]): void {
  try {
    const existingGames = getCachedGames() || [];

    // Create a map for quick lookup
    const gameMap = new Map(existingGames.map(game => [game.id, game]));

    // Update or add games
    updatedGames.forEach(game => {
      gameMap.set(game.id, game);
    });

    // Convert back to array
    const mergedGames = Array.from(gameMap.values());

    setCachedGames(mergedGames);
    console.log(`Merged ${updatedGames.length} updated games into cache of ${existingGames.length} games. Total: ${mergedGames.length}`);
  } catch (error) {
    console.error('Error merging games into cache:', error);
    // Don't throw - allow app to continue without file cache
  }
}
