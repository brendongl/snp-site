import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;

    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }

    const db = DatabaseService.initialize();

    // Get expansions using the dedicated service method
    const expansions = await db.games.getExpansions(gameId);

    return NextResponse.json({
      success: true,
      expansions,
      count: expansions.length,
    });
  } catch (error) {
    console.error('Error fetching expansions:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch expansions';

    return NextResponse.json(
      { error: errorMsg, success: false },
      { status: 500 }
    );
  }
}
