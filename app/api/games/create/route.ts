import { NextResponse } from 'next/server';
import { fetchBGGGame } from '@/lib/services/bgg-api';
import Airtable from 'airtable';
import { CreateGameInput } from '@/types';
import { logger } from '@/lib/logger';

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_GAMES_BASE_ID || '');
const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || '';

/**
 * Download image from URL and upload to Airtable
 */
async function downloadAndUploadImage(imageUrl: string): Promise<any> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    return {
      url: imageUrl,
    };
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

export async function POST(request: Request) {
  let bggIdForError: number | undefined;

  try {
    const body: CreateGameInput = await request.json();
    const { bggId, costPrice, gameSize, deposit, isExpansion, baseGameId, selectedImages, customImageUrls } = body;
    bggIdForError = bggId;

    logger.info('Game Creation', 'Starting game creation', { bggId, costPrice, gameSize, deposit, isExpansion, baseGameId, selectedImages, customImageUrls });

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

    // Prepare images - use selected images if provided, otherwise use defaults
    const images = [];

    if (selectedImages) {
      // Use user-selected images
      const boxImage = await downloadAndUploadImage(selectedImages.boxImage);
      if (boxImage) images.push(boxImage);

      if (selectedImages.gameplayImage) {
        const gameplayImage = await downloadAndUploadImage(selectedImages.gameplayImage);
        if (gameplayImage) images.push(gameplayImage);
      }
    } else {
      // Fallback to default images
      if (bggData.imageUrl) {
        const boxImage = await downloadAndUploadImage(bggData.imageUrl);
        if (boxImage) images.push(boxImage);
      }

      if (bggData.thumbnailUrl && bggData.thumbnailUrl !== bggData.imageUrl) {
        const setupImage = await downloadAndUploadImage(bggData.thumbnailUrl);
        if (setupImage) images.push(setupImage);
      }
    }

    // Add custom image URLs if provided
    if (customImageUrls && customImageUrls.length > 0) {
      logger.info('Game Creation', 'Processing custom image URLs', { count: customImageUrls.length });
      for (const customUrl of customImageUrls) {
        if (customUrl.trim()) {
          const customImage = await downloadAndUploadImage(customUrl.trim());
          if (customImage) {
            images.push(customImage);
            logger.debug('Game Creation', 'Added custom image', { url: customUrl });
          }
        }
      }
    }

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

    // Prepare Airtable record - remove undefined values as Airtable doesn't accept them
    const fields: any = {
      'Game Name': cleanedGameName,  // Use cleaned name to fix HTML entities
      'bggID': bggId.toString(),  // This field needs to be string
      'Description': cleanDescription,
      'Year Released': bggData.yearPublished,  // Number field
      'Min Players': bggData.minPlayers.toString(),  // String field in Airtable!
      'Max. Players': bggData.maxPlayers >= 99 ? 'No Limit' : bggData.maxPlayers.toString(),  // String field with special case!
      'Date of Aquisition': new Date().toISOString().split('T')[0],
    };

    // Add Categories (BGG categories only)
    if (cleanedCategories.length > 0) {
      fields['Categories'] = cleanedCategories;
    }

    // Add Mechanisms (BGG mechanisms - already synced with Airtable)
    if (cleanedMechanisms.length > 0) {
      fields['Mechanisms'] = cleanedMechanisms;
    }

    // Only add complexity if it exists
    if (bggData.complexity !== null && bggData.complexity !== undefined) {
      fields['Complexity'] = bggData.complexity;
    }

    // Add optional fields
    if (bggData.bestPlayerCount) {
      fields['Best Player Amount'] = bggData.bestPlayerCount.toString();
    }

    if (costPrice !== undefined && costPrice !== null) {
      fields['Cost Price'] = costPrice;
    }

    if (gameSize) {
      fields['Game Size (Rental)'] = gameSize;
    }

    if (deposit !== undefined && deposit !== null) {
      fields['Deposit'] = deposit;
    }

    // Handle expansion configuration
    if (isExpansion) {
      // Mark as expansion
      fields['Expansion'] = true;

      // Link to base game if provided
      if (baseGameId) {
        fields['Base Game'] = [baseGameId];
      }
    }

    // Add images if we have them
    if (images.length > 0) {
      fields['Images'] = images;
    }

    logger.info('Game Creation', 'Creating Airtable record', { gameName: bggData.name, fields });

    // Try to create record - if it fails due to missing categories/mechanisms, retry without them
    let record;
    try {
      record = await base(tableId).create([
        { fields },
      ]);
    } catch (createError: any) {
      const errorMessage = createError?.message || '';

      // Check if error is about invalid select options (missing categories/mechanisms)
      if (errorMessage.includes('Insufficient permissions to create new select option') ||
          errorMessage.includes('cannot accept') ||
          errorMessage.includes('invalid')) {

        logger.warn('Game Creation', 'Initial creation failed due to missing field options, retrying without invalid categories/mechanisms',
          { error: errorMessage, gameName: bggData.name });

        // Remove categories and mechanisms that might be causing the issue
        const fieldsWithoutSelects = { ...fields };
        delete fieldsWithoutSelects['Categories'];
        delete fieldsWithoutSelects['Mechanisms'];

        logger.info('Game Creation', 'Retrying without Categories and Mechanisms',
          { gameName: bggData.name, fieldsWithoutSelects });

        try {
          record = await base(tableId).create([
            { fields: fieldsWithoutSelects },
          ]);

          logger.warn('Game Creation', 'Successfully created game without Categories/Mechanisms',
            { gameName: bggData.name, categories: cleanedCategories, mechanisms: cleanedMechanisms });
        } catch (retryError) {
          // If it still fails, throw the original error
          throw createError;
        }
      } else {
        // If it's a different error, throw it
        throw createError;
      }
    }

    logger.info('Game Creation', `Successfully created game record: ${cleanedGameName}`, { airtableId: record[0].id });

    return NextResponse.json({
      success: true,
      message: `Successfully added ${cleanedGameName} to the collection`,
      gameId: record[0].id,
      gameName: cleanedGameName,
      bggData,
      warning: cleanedCategories.length > 0 || cleanedMechanisms.length > 0
        ? `⚠️ Game created but some categories/mechanisms couldn't be added. Try running the categories script in Airtable to add missing values.`
        : undefined,
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
