/**
 * Expansion Detection Endpoint
 * GET /api/expansions/detect
 *
 * Detects games that look like expansions based on naming patterns
 * but may not be marked as such
 */

import { NextResponse } from 'next/server';
import { gamesService } from '@/lib/airtable/games-service';
import { BoardGame } from '@/types';

// Common expansion keywords/patterns
const EXPANSION_PATTERNS = [
  /expansion/i,
  /extension/i,
  /: [a-z]/i, // "Game: something" format often indicates expansion
  /add-on/i,
  /addon/i,
  /supplement/i,
  /module/i,
  /promo/i,
  /scenario/i,
  /booster/i,
  /pack/i,
  /\(\w+( \w+)?\)$/, // (Word) or (Word Word) at end like "(Expansion)" or "(Base Game)"
  /second edition/i,
  /revised/i,
  /extended/i,
  /enhanced/i,
  /deluxe/i,
];

interface DetectedExpansion {
  gameId: string;
  gameName: string;
  matchedPatterns: string[];
  isMarkedAsExpansion: boolean;
  hasBaseGameLink: boolean;
}

function detectExpansionByName(game: BoardGame): DetectedExpansion | null {
  const gameName = game.fields['Game Name'];
  const isExpansion = game.fields['Expansion'] === true;
  const hasBaseGame = game.fields['Base Game'] && game.fields['Base Game'].length > 0;

  const matchedPatterns: string[] = [];

  for (const pattern of EXPANSION_PATTERNS) {
    if (pattern.test(gameName)) {
      matchedPatterns.push(pattern.source);
    }
  }

  // Only report if it looks like an expansion but isn't marked as one
  if (matchedPatterns.length > 0 && !isExpansion && !hasBaseGame) {
    return {
      gameId: game.id,
      gameName,
      matchedPatterns,
      isMarkedAsExpansion: false,
      hasBaseGameLink: false,
    };
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const games = await gamesService.getAllGames();

    const detectedExpansions: DetectedExpansion[] = games
      .map(game => detectExpansionByName(game))
      .filter((game): game is DetectedExpansion => game !== null)
      .sort((a, b) => a.gameName.localeCompare(b.gameName));

    return NextResponse.json({
      totalGames: games.length,
      detectedPotentialExpansions: detectedExpansions.length,
      expansions: detectedExpansions,
      message:
        detectedExpansions.length > 0
          ? `Found ${detectedExpansions.length} game(s) that look like expansions but aren't marked as such. Please verify and update Airtable if needed.`
          : 'No unmarked expansions detected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Expansion detection error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Detection failed',
      },
      { status: 500 }
    );
  }
}
