import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

/**
 * Transform database ContentCheck to Airtable-compatible format
 */
function transformToAirtableFormat(dbCheck: any) {
  return {
    id: dbCheck.id,
    fields: {
      'Record ID': dbCheck.id,
      'Board Game': dbCheck.gameId ? [dbCheck.gameId] : undefined,
      'Check Date': dbCheck.checkDate,
      'Inspector': dbCheck.inspectorName || dbCheck.inspectorId || 'Unknown Staff', // Use staff name if available
      'Status': Array.isArray(dbCheck.status) && dbCheck.status.length > 0
        ? dbCheck.status[0]
        : 'Unknown',
      'Missing Pieces': dbCheck.missingPieces || undefined, // Show actual text, not "Yes"
      'Box Condition': dbCheck.boxCondition,
      'Card Condition': dbCheck.cardCondition,
      'Is Fake': dbCheck.isFake,
      'Notes': dbCheck.notes,
      'Sleeved At Check': dbCheck.sleeved,
      'Box Wrapped At Check': dbCheck.boxWrapped,
      'Photos': Array.isArray(dbCheck.photos) && dbCheck.photos.length > 0
        ? dbCheck.photos.map((url: string) => ({
            id: url,
            url: url,
            filename: url.split('/').pop() || 'image',
            size: 0,
            type: 'image/jpeg',
          }))
        : undefined,
    },
  };
}

export async function GET(request: Request) {
  try {
    const db = DatabaseService.initialize();
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');

    // If requesting checks for a specific game
    if (gameId) {
      const dbChecks = await db.contentChecks.getChecksByGameId(gameId);
      const checks = dbChecks.map(transformToAirtableFormat);
      return NextResponse.json({
        checks,
        count: checks.length,
      });
    }

    // Get all checks from PostgreSQL
    const dbChecks = await db.contentChecks.getAllChecks();
    const checks = dbChecks.map(transformToAirtableFormat);

    return NextResponse.json({
      checks,
      count: checks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch content checks';

    return NextResponse.json(
      {
        error: `Failed to fetch content checks: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}
