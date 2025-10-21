import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gameName, description, yearReleased, minPlayers, maxPlayers, complexity } = await request.json();
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
      complexity,
    });

    // Build the update object (only include non-empty values)
    const updates: any = {};

    if (gameName) updates.name = gameName;
    if (description) updates.description = description;
    if (yearReleased !== undefined) updates.yearReleased = yearReleased;
    if (minPlayers) updates.minPlayers = String(minPlayers);  // Store as string
    if (maxPlayers) updates.maxPlayers = String(maxPlayers);  // Store as string
    if (complexity !== undefined) updates.complexity = complexity;

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
