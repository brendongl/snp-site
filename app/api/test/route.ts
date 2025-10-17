import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    logger.info('Test Route', 'Test endpoint accessed');

    // Test if logging is working
    console.log('Console: Test endpoint accessed');

    // Test if environment variables are loaded
    const hasAirtableKey = !!process.env.AIRTABLE_API_KEY;
    const hasGamesBase = !!process.env.AIRTABLE_GAMES_BASE_ID;

    // Return test response
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      environment: {
        hasAirtableKey,
        hasGamesBase,
        nodeEnv: process.env.NODE_ENV,
      },
      logPaths: logger.getLogPaths(),
    });
  } catch (error) {
    logger.error('Test Route', 'Test endpoint error', error as Error);
    console.error('Test endpoint error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}