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

    // Fetch all games with images from PostgreSQL using optimized single query
    console.log('Fetching games with images from PostgreSQL...');
    const gamesWithImages = await db.games.getAllGamesWithImages();

    console.log(`✅ Fetched ${gamesWithImages.length} games with images from PostgreSQL`);

    // Get categories for filter options
    const allCategories = getAllCategories(gamesWithImages);

    return NextResponse.json({
      games: gamesWithImages,
      totalCount: gamesWithImages.length,
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