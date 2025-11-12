/**
 * API Route: /api/cron/export-hours
 * Version: 2.0.0
 * Phase 1: Cron Infrastructure
 *
 * POST: Manually trigger daily hours export to Airtable
 * (Auto-runs daily at 11:59pm)
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterCronService from '@/lib/services/roster-cron-service';

export async function POST(request: NextRequest) {
  try {
    // TODO: Phase 3 - Add admin authentication check
    console.log('📤 Manual export triggered');

    await RosterCronService.runManualExport();

    return NextResponse.json({
      success: true,
      message: 'Hours export completed',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error running manual export:', error);
    return NextResponse.json(
      { error: 'Export failed', details: error.message },
      { status: 500 }
    );
  }
}
