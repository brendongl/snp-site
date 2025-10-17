import { NextResponse } from 'next/server';
import * as contentCheckerService from '@/lib/airtable/content-checker-service';
import { setCachedContentChecks, getContentChecksCacheMetadata } from '@/lib/cache/games-cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const oldCache = getContentChecksCacheMetadata();

    console.log('Refreshing content checks from Airtable...');
    const checks = await contentCheckerService.getAllChecks();

    setCachedContentChecks(checks);

    const newCache = getContentChecksCacheMetadata();

    return NextResponse.json({
      success: true,
      count: checks.length,
      previousUpdate: oldCache.lastUpdated,
      currentUpdate: newCache.lastUpdated,
    });
  } catch (error) {
    console.error('Error refreshing content checks:', error);
    return NextResponse.json(
      { error: 'Failed to refresh content checks' },
      { status: 500 }
    );
  }
}
