import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

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

    // Fetch all games INCLUDING EXPANSIONS with images from PostgreSQL
    console.log('Fetching all games including expansions from PostgreSQL...');

    const result = await db.pool.query(`
      SELECT
        g.id AS game_id,
        g.name,
        g.description,
        g.categories,
        g.year_released,
        g.complexity,
        g.min_players,
        g.max_players,
        g.best_player_amount,
        g.date_of_acquisition,
        g.latest_check_date,
        g.latest_check_status,
        g.latest_check_notes,
        g.total_checks,
        g.sleeved,
        g.box_wrapped,
        g.game_expansions_link,
        g.base_game_id,
        bg.name AS base_game_name,
        COALESCE(
          json_agg(
            json_build_object(
              'url', gi.url,
              'fileName', gi.file_name,
              'hash', gi.hash
            ) ORDER BY gi.id
          ) FILTER (WHERE gi.id IS NOT NULL),
          '[]'::json
        ) AS images
      FROM games g
      LEFT JOIN game_images gi ON g.id = gi.game_id
      LEFT JOIN games bg ON g.base_game_id = bg.id
      GROUP BY g.id, bg.name
      ORDER BY g.name ASC
    `);

    const gamesWithImages = result.rows.map((row) => ({
      id: row.game_id,
      fields: {
        'Game Name': row.base_game_id ? `${row.name} (Expansion for ${row.base_game_name})` : row.name,
        'Description': row.description,
        'Categories': row.categories || [],
        'Year Released': row.year_released,
        'Complexity': row.complexity,
        'Min Players': row.min_players,
        'Max. Players': row.max_players,
        'Best Player Amount': row.best_player_amount,
        'Date of Aquisition': row.date_of_acquisition,
        'Latest Check Date': row.latest_check_date,
        'Latest Check Status': row.latest_check_status ? [row.latest_check_status] : [],
        'Latest Check Notes': row.latest_check_notes || [],
        'Total Checks': row.total_checks,
        'Sleeved': row.sleeved,
        'Box Wrapped': row.box_wrapped,
        'Game Expansions Link': row.game_expansions_link || [],
      },
      images: row.images || [],
      isExpansion: !!row.base_game_id,
    }));

    console.log(`✅ Fetched ${gamesWithImages.length} games (including expansions) from PostgreSQL`);

    // Get categories for filter options
    const allCategories = getAllCategories(gamesWithImages);

    return NextResponse.json({
      games: gamesWithImages,
      totalCount: gamesWithImages.length,
      categories: allCategories,
    });
  } catch (error) {
    console.error('❌ Error fetching games with expansions from PostgreSQL:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch games';

    return NextResponse.json(
      {
        error: `Failed to fetch games from database: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}