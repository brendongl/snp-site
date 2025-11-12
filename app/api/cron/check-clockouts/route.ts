/**
 * API Route: /api/cron/check-clockouts
 * Version: 2.0.0
 * Phase 1: Cron Infrastructure
 *
 * POST: Manually trigger missing clock-out check
 * (Auto-runs daily at 9am)
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterCronService from '@/lib/services/roster-cron-service';

export async function POST(request: NextRequest) {
  try {
    // TODO: Phase 3 - Add admin authentication check
    console.log('🔍 Manual clock-out check triggered');

    await RosterCronService.runManualClockoutCheck();

    return NextResponse.json({
      success: true,
      message: 'Clock-out check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error running manual clock-out check:', error);
    return NextResponse.json(
      { error: 'Check failed', details: error.message },
      { status: 500 }
    );
  }
}
