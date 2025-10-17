/**
 * Expansion Validator
 * Ensures games marked as expansions are properly configured
 * and that expansions don't leak into the main gallery
 */

import { BoardGame } from '@/types';

export interface ExpansionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  gameId: string;
  gameName: string;
}

/**
 * Validate a single game's expansion configuration
 */
export function validateExpansionConfig(
  game: BoardGame
): ExpansionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isExpansion = game.fields['Expansion'] === true;
  const hasBaseGame = game.fields['Base Game'] && game.fields['Base Game'].length > 0;
  const hasExpansions = game.fields['Game Expansions Link'] && game.fields['Game Expansions Link'].length > 0;

  if (isExpansion && !hasBaseGame) {
    errors.push('Marked as expansion but no base game linked');
  }

  if (hasBaseGame && !isExpansion) {
    errors.push('Has base game link but not marked as expansion');
  }

  if (hasExpansions && isExpansion) {
    warnings.push('Game is marked as both expansion and has linked expansions');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    gameId: game.id,
    gameName: game.fields['Game Name'],
  };
}

/**
 * Validate all games and return problematic ones
 */
export function validateAllGames(games: BoardGame[]): {
  totalGames: number;
  validGames: number;
  invalidGames: ExpansionValidationResult[];
  gamesWithWarnings: ExpansionValidationResult[];
} {
  let validGames = 0;
  const invalidGames: ExpansionValidationResult[] = [];
  const gamesWithWarnings: ExpansionValidationResult[] = [];

  games.forEach((game) => {
    const result = validateExpansionConfig(game);

    if (!result.isValid) {
      invalidGames.push(result);
    } else if (result.warnings.length > 0) {
      gamesWithWarnings.push(result);
    } else {
      validGames++;
    }
  });

  return {
    totalGames: games.length,
    validGames,
    invalidGames,
    gamesWithWarnings,
  };
}

/**
 * Filter games to ensure expansions don't appear in main gallery
 * This is the safety net in case Expansion field isn't set
 */
export function filterOutMismarkedExpansions(games: BoardGame[]): {
  filtered: BoardGame[];
  removed: BoardGame[];
  issues: string[];
} {
  const removed: BoardGame[] = [];
  const issues: string[] = [];

  const filtered = games.filter((game) => {
    // If explicitly marked as expansion, filter it out
    if (game.fields['Expansion'] === true) {
      return true; // Keep marked expansions (they're intended to be filtered in UI)
    }

    // If has a base game link but not marked as expansion, this is likely a mismarked expansion
    if (game.fields['Base Game'] && game.fields['Base Game'].length > 0) {
      removed.push(game);
      issues.push(`Game "${game.fields['Game Name']}" has base game link but Expansion flag not set`);
      return false; // Remove it
    }

    return true; // Keep valid games
  });

  return { filtered, removed, issues };
}

/**
 * Generate a report of expansion configuration issues
 */
export function generateExpansionReport(games: BoardGame[]): string {
  const validation = validateAllGames(games);
  const mismarking = filterOutMismarkedExpansions(games);

  let report = `
🎮 Expansion Configuration Report
================================

Total Games: ${validation.totalGames}
Valid: ${validation.validGames}
Invalid: ${validation.invalidGames.length}
Warnings: ${validation.gamesWithWarnings.length}
Potentially Mismarked: ${mismarking.removed.length}

`;

  if (validation.invalidGames.length > 0) {
    report += `\n❌ INVALID CONFIGURATIONS:\n`;
    validation.invalidGames.forEach((game) => {
      report += `\n  • ${game.gameName} (ID: ${game.gameId})\n`;
      game.errors.forEach((error) => {
        report += `    - ${error}\n`;
      });
    });
  }

  if (mismarking.removed.length > 0) {
    report += `\n⚠️  POTENTIALLY MISMARKED EXPANSIONS:\n`;
    mismarking.issues.forEach((issue) => {
      report += `  • ${issue}\n`;
    });
  }

  if (validation.gamesWithWarnings.length > 0) {
    report += `\n⚡ WARNINGS:\n`;
    validation.gamesWithWarnings.forEach((game) => {
      report += `\n  • ${game.gameName} (ID: ${game.gameId})\n`;
      game.warnings.forEach((warning) => {
        report += `    - ${warning}\n`;
      });
    });
  }

  if (validation.invalidGames.length === 0 && mismarking.removed.length === 0 && validation.gamesWithWarnings.length === 0) {
    report += '\n✅ All games are properly configured!\n';
  }

  return report;
}
