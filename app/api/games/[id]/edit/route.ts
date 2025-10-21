import { NextResponse } from 'next/server';

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

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
    const tableId = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
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

    // Build the fields to update (only include non-empty values)
    const updateFields: Record<string, any> = {};

    if (gameName) updateFields['Game Name'] = gameName;
    if (description) updateFields['Description'] = description;
    if (yearReleased) updateFields['Year Released'] = yearReleased;
    if (minPlayers) updateFields['Min Players'] = minPlayers;
    if (maxPlayers) updateFields['Max. Players'] = maxPlayers;
    if (complexity !== undefined) updateFields['Complexity'] = complexity;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update record in Airtable
    const updateResponse = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}/${gameId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: updateFields,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      const errorMessage = (errorData as any).error?.message || updateResponse.statusText;
      console.error('Airtable update error:', errorMessage);

      return NextResponse.json(
        {
          success: false,
          error: `Failed to update game: ${errorMessage}`,
        },
        { status: updateResponse.status }
      );
    }

    const updatedData = await updateResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Game updated successfully',
      gameId,
      updatedFields: updateFields,
      record: updatedData,
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
