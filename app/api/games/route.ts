import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import GamesDbService from '@/lib/services/games-db-service';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// Helper function to extract unique categories from all games
function getAllCategories(games: any[]): string[] {
  const categories = new Set<string>();
  games.forEach(game => {
    const gameCategories = game.fields.Categories || [];
    gameCategories.forEach((cat: string) => categories.add(cat));
  });
  return Array.from(categories).sort();
}

export async function GET(request: Request) {
  try {
    // Initialize database service
    const db = DatabaseService.initialize();

    // Fetch all games with images from PostgreSQL using optimized single query
    console.log('Fetching games with images from PostgreSQL...');
    const gamesWithImages = await db.games.getAllGamesWithImages();

    console.log(`✅ Fetched ${gamesWithImages.length} games with images from PostgreSQL`);

    // v1.3.0: Fetch play logs for all games to calculate needsCheckingInfo
    const playLogsResult = await pool.query(`
      SELECT
        game_id,
        played_at,
        created_at
      FROM play_logs
      ORDER BY game_id, played_at DESC
    `);

    // Group play logs by game_id
    const playLogsByGame = playLogsResult.rows.reduce((acc, log) => {
      if (!acc[log.game_id]) {
        acc[log.game_id] = [];
      }
      acc[log.game_id].push(log);
      return acc;
    }, {} as Record<string, any[]>);

    // v1.3.0: Enrich each game with needsCheckingInfo
    const enrichedGames = gamesWithImages.map(game => {
      const playLogs = playLogsByGame[game.id] || [];
      const needsCheckingInfo = GamesDbService.calculateNeedsChecking(game, playLogs);

      return {
        ...game,
        needsCheckingInfo, // Attach the needs checking metadata
      };
    });

    // Get categories for filter options
    const allCategories = getAllCategories(enrichedGames);

    return NextResponse.json({
      games: enrichedGames, // v1.3.0: Now includes needsCheckingInfo for each game
      totalCount: enrichedGames.length,
      categories: allCategories,
    });
  } catch (error) {
    console.error('❌ Error fetching games from PostgreSQL:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch games';

    return NextResponse.json(
      {
        error: `Failed to fetch games from database: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}