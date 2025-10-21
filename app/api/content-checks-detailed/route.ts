import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = DatabaseService.initialize();

    // Fetch all content checks with game names via JOIN
    const checks = await db.contentChecks.getAllChecksWithGameNames();

    return NextResponse.json({
      checks,
      count: checks.length,
    });
  } catch (error) {
    console.error('Error in content checks API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content checks';

    return NextResponse.json(
      {
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
