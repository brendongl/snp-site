import { NextRequest, NextResponse } from 'next/server';
import ContentChecksDbService from '@/lib/services/content-checks-db-service';
import { logger } from '@/lib/logger';

const contentChecksService = new ContentChecksDbService(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originalCheckId, gameId, staffId, isPerfectCondition, remainingIssues } = body;

    // Validation
    if (!originalCheckId || !gameId || !staffId || isPerfectCondition === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: originalCheckId, gameId, staffId, isPerfectCondition' },
        { status: 400 }
      );
    }

    // If not perfect condition, require remaining issues description
    if (!isPerfectCondition && (!remainingIssues || !remainingIssues.trim())) {
      return NextResponse.json(
        { error: 'remainingIssues is required when isPerfectCondition is false' },
        { status: 400 }
      );
    }

    logger.info('Content Check Resolution', 'Resolving issue', {
      originalCheckId,
      gameId,
      staffId,
      isPerfectCondition,
    });

    // Create new content check with resolution tracking
    const newCheck = await contentChecksService.createCheck({
      gameId,
      inspectorId: staffId,
      checkDate: new Date().toISOString(),
      checkType: 'regular',
      status: isPerfectCondition ? ['Perfect Condition'] : ['Minor Issues'],
      missingPieces: isPerfectCondition ? null : remainingIssues.trim(),
      boxCondition: 'Good', // Default, can be enhanced later
      cardCondition: 'Good', // Default, can be enhanced later
      isFake: false,
      notes: `Resolved previous issue from check ${originalCheckId}`,
      sleeved: false,
      boxWrapped: false,
      photos: [],
      hasIssue: !isPerfectCondition, // v1.2.0: FALSE if perfect, TRUE if still has issues
      resolvedById: staffId, // v1.2.0: Staff who resolved the issue
      resolvedFromCheckId: originalCheckId, // v1.2.0: Link to original check
    });

    logger.info('Content Check Resolution', 'Resolution check created', {
      newCheckId: newCheck.id,
      isPerfect: isPerfectCondition,
    });

    return NextResponse.json({
      success: true,
      checkId: newCheck.id,
      message: isPerfectCondition
        ? 'Game marked as Perfect Condition'
        : 'Remaining issues recorded',
    });
  } catch (error) {
    logger.error('Content Check Resolution', 'Error resolving issue', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to resolve issue' },
      { status: 500 }
    );
  }
}
