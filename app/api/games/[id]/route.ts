import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = await gamesService.getGameById(id);

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}