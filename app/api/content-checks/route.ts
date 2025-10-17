import { NextResponse } from 'next/server';
import * as contentCheckerService from '@/lib/airtable/content-checker-service';
import { getCachedContentChecks, setCachedContentChecks } from '@/lib/cache/games-cache';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    // If requesting checks for a specific game
    if (gameId) {
      const checks = await contentCheckerService.getChecksForGame(gameId);
      return NextResponse.json({
        checks,
        count: checks.length,
      });
    }

    // Get all checks from cache
    let allChecks = getCachedContentChecks();

    if (!allChecks) {
      console.log('Content checks cache miss - fetching from Airtable');
      allChecks = await contentCheckerService.getAllChecks();
      setCachedContentChecks(allChecks);
    } else {
      console.log(`Content checks cache hit - returning ${allChecks.length} checks`);
    }

    return NextResponse.json({
      checks: allChecks,
      count: allChecks.length,
    });
  } catch (error) {
    console.error('Error in content checks API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content checks' },
      { status: 500 }
    );
  }
}
