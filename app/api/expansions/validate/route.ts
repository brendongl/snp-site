/**
 * Expansion Validation Endpoint
 * GET /api/expansions/validate
 *
 * Validates expansion configuration in the games collection
 * Returns a report of any misconfigurations
 */

import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { validateAllGames, generateExpansionReport } from '@/lib/airtable/expansion-validator';

export async function GET(request: Request) {
  try {
    const games = await gamesService.getAllGames();

    const validation = validateAllGames(games);

    // Return both summary and detailed report
    return NextResponse.json({
      summary: {
        totalGames: validation.totalGames,
        validGames: validation.validGames,
        invalidGames: validation.invalidGames.length,
        gamesWithWarnings: validation.gamesWithWarnings.length,
      },
      details: {
        invalid: validation.invalidGames.map(game => ({
          gameId: game.gameId,
          gameName: game.gameName,
          errors: game.errors,
        })),
        warnings: validation.gamesWithWarnings.map(game => ({
          gameId: game.gameId,
          gameName: game.gameName,
          warnings: game.warnings,
        })),
      },
      report: generateExpansionReport(games),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Expansion validation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Validation failed',
      },
      { status: 500 }
    );
  }
}
