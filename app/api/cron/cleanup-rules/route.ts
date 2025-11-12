/**
 * API Route: /api/cron/cleanup-rules
 * Version: 2.0.0
 * Phase 1: Cron Infrastructure
 *
 * POST: Manually trigger expired rule cleanup
 * (Auto-runs midnight Sunday)
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterCronService from '@/lib/services/roster-cron-service';

export async function POST(request: NextRequest) {
  try {
    // TODO: Phase 3 - Add admin authentication check
    console.log('🧹 Manual cleanup triggered');

    await RosterCronService.runManualCleanup();

    return NextResponse.json({
      success: true,
      message: 'Rule cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error running manual cleanup:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: error.message },
      { status: 500 }
    );
  }
}
