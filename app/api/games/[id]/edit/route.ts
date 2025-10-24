import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import { logGameUpdate } from '@/lib/services/changelog-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gameName, description, yearReleased, minPlayers, maxPlayers, bestPlayerAmount, complexity, dateAcquired, categories, baseGameId, deposit, costPrice, gameSize, staffId, staffName } = await request.json();
    const { id: gameId } = await params;

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }

    console.log('Game edit request received:', {
      gameId,
      gameName,
      description,
      yearReleased,
      minPlayers,
      maxPlayers,
      bestPlayerAmount,
      complexity,
      dateAcquired,
      categories,
      baseGameId,
      deposit,
      costPrice,
      gameSize,
    });

    // Build the update object (only include non-empty values)
    const updates: any = {};

    if (gameName) updates.name = gameName;
    if (description) updates.description = description;
    if (yearReleased !== undefined) updates.year_released = yearReleased;
    if (minPlayers) updates.min_players = String(minPlayers);  // Store as string
    if (maxPlayers) updates.max_players = String(maxPlayers);  // Store as string
    if (bestPlayerAmount !== undefined) updates.best_player_amount = String(bestPlayerAmount); // Store as string
    if (complexity !== undefined) updates.complexity = complexity;
    if (dateAcquired) updates.date_of_acquisition = dateAcquired;
    if (categories) updates.categories = categories; // Array of strings
    if (baseGameId !== undefined) updates.base_game_id = baseGameId || null;
    if (deposit !== undefined) updates.deposit = deposit;
    if (costPrice !== undefined) updates.cost_price = costPrice;
    if (gameSize !== undefined) updates.game_size = gameSize || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update record in PostgreSQL
    const db = DatabaseService.initialize();
    await db.games.updateGame(gameId, updates);

    // Fetch the updated game to return
    const updatedGame = await db.games.getGameById(gameId);

    // Log to changelog
    try {
      await logGameUpdate(
        gameId,
        gameName || updatedGame?.fields?.['Game Name'] || 'Unknown Game',
        staffName || 'System',
        staffId || 'system',
        updates
      );
    } catch (changelogError) {
      console.error('Failed to log game update to changelog:', changelogError);
    }

    return NextResponse.json({
      success: true,
      message: 'Game updated successfully in PostgreSQL',
      gameId,
      updatedFields: updates,
      game: updatedGame,
    });
  } catch (error) {
    console.error('Error editing game:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to edit game';

    return NextResponse.json(
      { error: errorMsg, success: false },
      { status: 500 }
    );
  }
}
