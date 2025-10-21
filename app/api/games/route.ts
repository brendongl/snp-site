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

    // Fetch all games from PostgreSQL (instant, no network latency)
    console.log('Fetching games from PostgreSQL...');
    const allGames = await db.games.getAllGames();

    console.log(`✅ Fetched ${allGames.length} games from PostgreSQL`);

    // Fetch images for each game and add to game data
    console.log('Fetching game images...');
    const gamesWithImages = await Promise.all(
      allGames.map(async (game) => {
        const images = await db.games.getGameImages(game.id);
        return {
          ...game,
          images: images.map(img => ({
            url: img.url,
            fileName: img.fileName,
            hash: img.hash,
          })),
        };
      })
    );

    console.log(`✅ Added images to games`);

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