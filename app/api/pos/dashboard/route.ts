// app/api/pos/dashboard/route.ts
// iPOS Dashboard API - Calls remote microservice (deployed on Render/fly.io)
// Why: Railway doesn't support Playwright, so we use a separate service that does
import { NextResponse } from 'next/server';
import { iposRemote } from '@/lib/services/ipos-remote-service';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

// Cache for 5 minutes to reduce API calls
let cachedData: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    console.log('[iPOS API] Fetching dashboard data...');

    // Check if we have cached data that's still valid
    const now = Date.now();
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('[iPOS API] Returning cached data');
      return NextResponse.json({
        success: true,
        data: cachedData,
        timestamp: new Date().toISOString(),
        cached: true
      });
    }

    // Fetch data from remote microservice (deployed on Render/fly.io)
    const dashboardData = await iposRemote.getDashboardData();

    // Check if we got valid data
    if (!dashboardData.lastUpdated) {
      console.error('[iPOS API] Invalid response - no lastUpdated field');
      return NextResponse.json({
        success: false,
        error: 'Invalid response from iPOS API',
        data: {
          unpaidAmount: 0,
          paidAmount: 0,
          currentTables: 0,
          currentCustomers: 0,
          lastUpdated: new Date().toISOString()
        }
      }, { status: 500 });
    }

    // Cache the successful result
    cachedData = dashboardData;
    cacheTimestamp = now;

    console.log('[iPOS API] Successfully fetched dashboard data:', dashboardData);

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
      cached: false
    });

  } catch (error) {
    console.error('[iPOS API] Error in /api/pos/dashboard:', error);

    // Return cached data if available, even if stale
    if (cachedData) {
      console.log('[iPOS API] Returning stale cached data due to error');
      return NextResponse.json({
        success: true,
        data: cachedData,
        timestamp: new Date().toISOString(),
        cached: true,
        stale: true
      });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch POS dashboard data',
      data: {
        unpaidAmount: 0,
        paidAmount: 0,
        currentTables: 0,
        currentCustomers: 0,
        lastUpdated: new Date().toISOString()
      }
    }, { status: 500 });
  }
}
