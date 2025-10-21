import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';
import Airtable from 'airtable';

export const dynamic = 'force-dynamic';

// Verify admin authentication
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  // Check for admin token in headers
  const adminToken = request.headers.get('x-admin-token');
  const expectedToken = process.env.ADMIN_SYNC_TOKEN;

  if (!expectedToken) {
    console.warn('⚠️  ADMIN_SYNC_TOKEN not configured - admin sync disabled');
    return false;
  }

  return adminToken === expectedToken;
}

/**
 * POST /api/admin/sync-to-airtable
 *
 * Syncs PostgreSQL data back to Airtable as a backup.
 * Requires admin authentication via x-admin-token header.
 *
 * Query parameters:
 * - type: 'games' | 'checks' | 'knowledge' | 'all' (default: 'all')
 * - fullSync: 'true' | 'false' (default: 'false')
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin token required' },
        { status: 401 }
      );
    }

    const db = DatabaseService.getInstance();
    const { searchParams } = request.nextUrl;
    const syncType = searchParams.get('type') || 'all';
    const fullSync = searchParams.get('fullSync') === 'true';

    // Initialize Airtable
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AIRTABLE_API_KEY not configured' },
        { status: 500 }
      );
    }

    const airtable = new Airtable({ apiKey });
    const gamesBase = airtable.base(process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu');
    const gamesTable = gamesBase(process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr');
    const checksTable = gamesBase(process.env.AIRTABLE_CONTENT_CHECKS_TABLE_ID || 'tblN8mYWb0xkJOBcW');
    const knowledgeTable = gamesBase(process.env.AIRTABLE_STAFF_KNOWLEDGE_TABLE_ID || 'tblEsKvKBFfmN8GJe');

    const results: any = {};
    const startTime = Date.now();

    console.log(`🔄 Starting Airtable sync (type=${syncType}, fullSync=${fullSync})`);

    // Sync games
    if (syncType === 'all' || syncType === 'games') {
      console.log('\n📚 Syncing games to Airtable...');
      try {
        const games = await db.games.getAllGames();
        let synced = 0;
        let errors = 0;

        for (const game of games) {
          try {
            // Use the correct Airtable API format for update
            await (gamesTable as any).update(game.id, {
              fields: {
                'Game Name': game.fields['Game Name'],
                'Description': game.fields['Description'],
                'Categories': game.fields['Categories'] || [],
                'Year Released': game.fields['Year Released'],
                'Complexity': game.fields['Complexity'],
                'Min Players': game.fields['Min Players'],
                'Max. Players': game.fields['Max. Players'],
                'Best Player Amount': game.fields['Best Player Amount'],
                'Date of Aquisition': game.fields['Date of Aquisition'],
                'Latest Check Date': game.fields['Latest Check Date'],
                'Latest Check Status': game.fields['Latest Check Status'] || [],
                'Latest Check Notes': game.fields['Latest Check Notes'] || [],
                'Total Checks': game.fields['Total Checks'],
                'Sleeved': game.fields['Sleeved'],
                'Box Wrapped': game.fields['Box Wrapped'],
                'Expansion': game.fields['Expansion'],
                'Game Expansions Link': game.fields['Game Expansions Link'] || [],
              },
            });
            synced++;

            if (synced % 50 === 0) {
              console.log(`  ✓ Synced ${synced}/${games.length} games...`);
            }
          } catch (error) {
            console.error(`  ✗ Error syncing game ${game.id}:`, error);
            errors++;
          }
        }

        results.games = {
          total: games.length,
          synced,
          errors,
          duration: Date.now() - startTime,
        };
        console.log(`✅ Games sync complete: ${synced}/${games.length} synced, ${errors} errors`);
      } catch (error) {
        console.error('❌ Error syncing games:', error);
        results.games = { error: String(error) };
      }
    }

    // Sync content checks
    if (syncType === 'all' || syncType === 'checks') {
      console.log('\n🔍 Syncing content checks to Airtable...');
      try {
        const checks = await db.contentChecks.getAllChecks();
        let synced = 0;
        let errors = 0;

        for (const check of checks) {
          try {
            // Use the correct Airtable API format for update
            await (checksTable as any).update(check.id, {
              fields: {
                'Board Game': [check.gameId],
                'Inspector': [check.inspectorId],
                'Latest Check': check.checkDate,
                'Content Check Status': check.status || [],
                'Missing Pieces': check.missingPieces,
                'Box Condition': check.boxCondition,
                'Card Condition': check.cardCondition,
                'Is Counterfeit': check.isFake,
                'Notes': check.notes,
                'Sleeved': check.sleeved,
                'Box Wrapped': check.boxWrapped,
                'Photos': check.photos,
              },
            });
            synced++;

            if (synced % 50 === 0) {
              console.log(`  ✓ Synced ${synced}/${checks.length} checks...`);
            }
          } catch (error) {
            console.error(`  ✗ Error syncing check ${check.id}:`, error);
            errors++;
          }
        }

        results.checks = {
          total: checks.length,
          synced,
          errors,
          duration: Date.now() - startTime,
        };
        console.log(`✅ Checks sync complete: ${synced}/${checks.length} synced, ${errors} errors`);
      } catch (error) {
        console.error('❌ Error syncing checks:', error);
        results.checks = { error: String(error) };
      }
    }

    // Sync staff knowledge
    if (syncType === 'all' || syncType === 'knowledge') {
      console.log('\n👨‍🎓 Syncing staff knowledge to Airtable...');
      try {
        const knowledge = await db.staffKnowledge.getAllKnowledge();
        let synced = 0;
        let errors = 0;

        // Map confidence level back to text for Airtable
        const confidenceMap: { [key: number]: string } = {
          25: 'Beginner',
          50: 'Intermediate',
          75: 'Advanced',
          100: 'Expert',
        };

        for (const k of knowledge) {
          try {
            const levelText = confidenceMap[k.confidenceLevel] || `Level ${k.confidenceLevel}`;

            // Use the correct Airtable API format for update
            await (knowledgeTable as any).update(k.id, {
              fields: {
                'Staff': [k.staffMemberId],
                'Game': [k.gameId],
                'Knowledge Level': levelText,
                'Can Teach': k.canTeach,
                'Notes': k.notes,
              },
            });
            synced++;

            if (synced % 50 === 0) {
              console.log(`  ✓ Synced ${synced}/${knowledge.length} records...`);
            }
          } catch (error) {
            console.error(`  ✗ Error syncing knowledge ${k.id}:`, error);
            errors++;
          }
        }

        results.knowledge = {
          total: knowledge.length,
          synced,
          errors,
          duration: Date.now() - startTime,
        };
        console.log(`✅ Knowledge sync complete: ${synced}/${knowledge.length} synced, ${errors} errors`);
      } catch (error) {
        console.error('❌ Error syncing knowledge:', error);
        results.knowledge = { error: String(error) };
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n✨ Sync completed in ${totalDuration}ms`);

    return NextResponse.json(
      {
        success: true,
        message: `Airtable sync completed (${totalDuration}ms)`,
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: `Sync failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-to-airtable
 *
 * Get sync status and documentation.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: '/api/admin/sync-to-airtable',
    method: 'POST',
    description: 'Sync PostgreSQL data back to Airtable as backup',
    authentication: 'x-admin-token header (required)',
    queryParameters: {
      type: {
        description: 'What to sync: games, checks, knowledge, or all',
        default: 'all',
        values: ['games', 'checks', 'knowledge', 'all'],
      },
      fullSync: {
        description: 'Force full sync instead of incremental',
        default: 'false',
        values: ['true', 'false'],
      },
    },
    examples: {
      syncAll: 'POST /api/admin/sync-to-airtable?type=all',
      syncGames: 'POST /api/admin/sync-to-airtable?type=games',
      syncChecks: 'POST /api/admin/sync-to-airtable?type=checks',
      syncKnowledge: 'POST /api/admin/sync-to-airtable?type=knowledge',
    },
    headers: {
      'x-admin-token': 'Required - Set via ADMIN_SYNC_TOKEN environment variable',
    },
  });
}
