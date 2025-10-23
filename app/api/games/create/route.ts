import { NextResponse } from 'next/server';
import { fetchBGGGame } from '@/lib/services/bgg-api';
import { CreateGameInput } from '@/types';
import { logger } from '@/lib/logger';
import DatabaseService from '@/lib/services/db-service';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_CACHE_DIR = path.join(process.cwd(), 'data', 'images');

/**
 * Generate MD5 hash for image content (not URL)
 */
function generateImageContentHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Download and cache an image from a URL
 * Returns the hash of the cached image
 */
async function downloadAndCacheImage(imageUrl: string): Promise<string | null> {
  try {
    // Ensure cache directory exists
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true, mode: 0o755 });
    }

    // Download image
    logger.debug('Image Download', 'Downloading image', { imageUrl });
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      logger.warn('Image Download', 'Failed to download image', { imageUrl, status: response.status });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = generateImageContentHash(buffer);

    // Detect file extension from URL or content-type
    const urlParts = imageUrl.split('?')[0]; // Remove query params
    const urlExtension = urlParts.split('.').pop()?.toLowerCase() || '';
    const contentType = response.headers.get('content-type') || '';

    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    let extension = validExtensions.includes(urlExtension) ? urlExtension : null;

    if (!extension) {
      // Fallback to content-type
      const typeMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
      };
      extension = typeMap[contentType] || 'jpg';
    }

    const filePath = path.join(IMAGE_CACHE_DIR, `${hash}.${extension}`);

    // Check if already cached
    if (fs.existsSync(filePath)) {
      logger.debug('Image Download', 'Image already cached', { hash, imageUrl });
      return hash;
    }

    // Save to disk
    fs.writeFileSync(filePath, buffer);
    logger.info('Image Download', 'Successfully cached image', { hash, size: buffer.length, imageUrl });

    return hash;
  } catch (error) {
    logger.error('Image Download', 'Error downloading/caching image', error instanceof Error ? error : new Error(String(error)), { imageUrl });
    return null;
  }
}

export async function POST(request: Request) {
  let bggIdForError: number | undefined;

  try {
    const body: CreateGameInput = await request.json();
    const { bggId, costPrice, gameSize, deposit, dateOfAcquisition, isExpansion, baseGameId, selectedImages, customImageUrls } = body;
    bggIdForError = bggId;

    logger.info('Game Creation', 'Starting game creation', { bggId, costPrice, gameSize, deposit, dateOfAcquisition, isExpansion, baseGameId, selectedImages, customImageUrls });

    // Validate input
    if (!bggId || typeof bggId !== 'number' || bggId <= 0) {
      logger.warn('Game Creation', 'Invalid BGG ID provided', { bggId });
      return NextResponse.json(
        { error: 'Valid BGG ID is required' },
        { status: 400 }
      );
    }

    // Fetch game data from BGG
    logger.info('Game Creation', `Fetching game from BGG ID: ${bggId}`);
    const bggData = await fetchBGGGame(bggId);
    logger.debug('Game Creation', 'BGG data fetched', bggData);

    // Clean HTML entities from text
    const cleanText = (text: string) => text
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&#039;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');

    // Clean game name, categories, and mechanisms
    const cleanedGameName = cleanText(bggData.name);
    const cleanedCategories = bggData.categories.map(cleanText);
    const cleanedMechanisms = bggData.mechanisms.map(cleanText);

    // Clean up HTML entities in description
    const cleanDescription = (bggData.description || '')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#10;/g, '\n')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Generate game ID
    const gameId = `rec${Date.now()}${Math.random().toString(36).substring(2, 15)}`;

    // Initialize database service
    const db = DatabaseService.initialize();

    // Prepare game data for PostgreSQL
    const gameData: any = {
      id: gameId,
      name: cleanedGameName,
      description: cleanDescription,
      categories: cleanedCategories,
      mechanisms: cleanedMechanisms,
      yearReleased: bggData.yearPublished,
      minPlayers: bggData.minPlayers.toString(),
      maxPlayers: bggData.maxPlayers >= 99 ? 'No Limit' : bggData.maxPlayers.toString(),
      bggId: bggId.toString(),
      dateOfAcquisition: dateOfAcquisition || new Date().toISOString().split('T')[0],
      minPlaytime: bggData.minPlaytime || null,
      maxPlaytime: bggData.maxPlaytime || null,
    };

    // Add optional fields
    if (bggData.complexity !== null && bggData.complexity !== undefined) {
      gameData.complexity = bggData.complexity;
    }
    if (bggData.bestPlayerCount) {
      gameData.bestPlayerAmount = bggData.bestPlayerCount.toString();
    }
    if (costPrice !== undefined && costPrice !== null) {
      gameData.costPrice = costPrice;
    }
    if (gameSize) {
      gameData.gameSize = gameSize;
    }
    if (deposit !== undefined && deposit !== null) {
      gameData.deposit = deposit;
    }

    // Handle expansion configuration
    if (isExpansion) {
      gameData.isExpansion = true;
      if (baseGameId) {
        gameData.baseGameId = baseGameId;
      }
    }

    logger.info('Game Creation', 'Creating game in PostgreSQL', { gameName: cleanedGameName, gameData });

    // Create game record in PostgreSQL
    const createdGame = await db.games.createGame(gameData);

    // Handle images
    const imageUrls: string[] = [];

    if (selectedImages) {
      imageUrls.push(selectedImages.boxImage);
      if (selectedImages.gameplayImage) {
        imageUrls.push(selectedImages.gameplayImage);
      }
    } else {
      if (bggData.imageUrl) imageUrls.push(bggData.imageUrl);
      if (bggData.thumbnailUrl && bggData.thumbnailUrl !== bggData.imageUrl) {
        imageUrls.push(bggData.thumbnailUrl);
      }
    }

    // Add custom images
    if (customImageUrls && customImageUrls.length > 0) {
      logger.info('Game Creation', 'Processing custom image URLs', { count: customImageUrls.length });
      customImageUrls.forEach((url: string) => {
        if (url.trim()) imageUrls.push(url.trim());
      });
    }

    // Download and cache images to disk, then add to PostgreSQL
    for (const imageUrl of imageUrls) {
      try {
        // Download and cache the image (returns hash of image content)
        const hash = await downloadAndCacheImage(imageUrl);

        if (!hash) {
          logger.warn('Game Creation', 'Failed to download/cache image, skipping', { imageUrl });
          continue;
        }

        // Add to PostgreSQL with the content hash
        await db.games.addGameImage(gameId, imageUrl, hash);
        logger.debug('Game Creation', 'Downloaded, cached, and added image to PostgreSQL', { imageUrl, hash });
      } catch (imageError) {
        logger.warn('Game Creation', 'Failed to add image', { imageUrl, error: imageError });
      }
    }

    logger.info('Game Creation', `Successfully created game in PostgreSQL: ${cleanedGameName}`, { gameId });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${cleanedGameName} to the collection`,
      gameId,
      gameName: cleanedGameName,
      bggData,
    });

  } catch (error) {
    logger.error('Game Creation', 'Failed to create game', error instanceof Error ? error : new Error(String(error)), { bggId: bggIdForError });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create game',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
