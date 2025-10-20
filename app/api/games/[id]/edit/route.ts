import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { gameName, description, yearReleased, minPlayers, maxPlayers, complexity } = await request.json();
    const { id: gameId } = await params;

    // Note: For local dev, we're just returning success
    // In production, this would call the Airtable API to update the record
    // For now, we'll just acknowledge the change locally

    console.log('Game edit request received:', {
      gameId,
      gameName,
      description,
      yearReleased,
      minPlayers,
      maxPlayers,
      complexity,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Game updated successfully (local dev)',
      gameId,
    });
  } catch (error) {
    console.error('Error editing game:', error);
    return NextResponse.json(
      { error: 'Failed to edit game' },
      { status: 500 }
    );
  }
}
