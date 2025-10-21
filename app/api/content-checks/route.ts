import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = DatabaseService.initialize();
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    // If requesting checks for a specific game
    if (gameId) {
      console.log(`Fetching content checks for game: ${gameId}`);
      const checks = await db.contentChecks.getChecksByGameId(gameId);
      return NextResponse.json({
        checks,
        count: checks.length,
      });
    }

    // Get all checks from PostgreSQL
    console.log('Fetching all content checks from PostgreSQL...');
    const allChecks = await db.contentChecks.getAllChecks();

    console.log(`✅ Fetched ${allChecks.length} content checks from PostgreSQL`);

    return NextResponse.json({
      checks: allChecks,
      count: allChecks.length,
    });
  } catch (error) {
    console.error('❌ Error in content checks API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content checks';

    return NextResponse.json(
      {
        error: `Failed to fetch content checks: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}
