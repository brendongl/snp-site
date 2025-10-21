import { NextRequest, NextResponse } from 'next/server';
import { persistentVolume, PersistentVolume } from '@/lib/storage/persistent-volume';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

/**
 * Verify admin authentication
 */
function verifyAdmin(request: NextRequest): boolean {
  const adminToken = request.headers.get('x-admin-token');
  const expectedToken = process.env.ADMIN_SYNC_TOKEN;

  if (!expectedToken) {
    return false;
  }

  return adminToken === expectedToken;
}

/**
 * GET /api/admin/storage
 *
 * Get storage statistics and environment info
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin
    if (!verifyAdmin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin token required' },
        { status: 401 }
      );
    }

    const stats = persistentVolume.getStatistics();
    const envInfo = PersistentVolume.getEnvironmentInfo();

    return NextResponse.json({
      storage: stats,
      environment: envInfo,
      railwayInfo: {
        isRailway: PersistentVolume.isRailway(),
        environment: process.env.RAILWAY_ENVIRONMENT_NAME,
        appName: process.env.RAILWAY_SERVICE_NAME,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
      },
    });
  } catch (error) {
    console.error('❌ Error getting storage stats:', error);
    return NextResponse.json(
      { error: 'Failed to get storage statistics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/storage?action=cleanup
 *
 * Clean up unused images from storage
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin
    if (!verifyAdmin(request)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin token required' },
        { status: 401 }
      );
    }

    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action');

    if (action === 'cleanup') {
      console.log('🧹 Starting storage cleanup...');

      // Get all image hashes currently in use
      const db = DatabaseService.getInstance();
      const games = await db.games.getAllGames();
      const hashesToKeep = new Set<string>();

      // Collect all hashes from all games
      for (const game of games) {
        const images = await db.games.getGameImages(game.id);
        images.forEach(img => hashesToKeep.add(img.hash));
      }

      // Clean up unused images
      const result = await persistentVolume.cleanupUnusedImages(hashesToKeep);

      return NextResponse.json({
        success: true,
        action: 'cleanup',
        result,
        message: `Cleanup complete: ${result.deleted} files deleted, ${(result.freed / 1024 / 1024).toFixed(2)} MB freed`,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Error in storage action:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Action failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
