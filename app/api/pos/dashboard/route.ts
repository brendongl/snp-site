// app/api/pos/dashboard/route.ts
// iPOS Dashboard API - Using Playwright HTML scraping due to CORS restrictions
import { NextResponse } from 'next/server';
import { fetchIPOSDashboardData, getIPOSCredentials } from '@/lib/services/ipos-playwright-service';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  try {
    console.log('[iPOS Playwright] Fetching dashboard data...');

    // Get credentials from environment
    const credentials = getIPOSCredentials();

    if (!credentials) {
      console.error('[iPOS Playwright] No credentials configured');
      return NextResponse.json({
        success: false,
        error: 'iPOS credentials not configured',
        data: {
          unpaidAmount: 0,
          paidAmount: 0,
          currentTables: 0,
          currentCustomers: 0,
          lastUpdated: new Date().toISOString()
        }
      }, { status: 500 });
    }

    // Fetch data using Playwright HTML scraping
    const dashboardData = await fetchIPOSDashboardData(credentials);

    // Check if we got valid data (at least one field should be > 0 or we have a lastUpdated)
    if (!dashboardData.lastUpdated) {
      console.error('[iPOS Playwright] Invalid response - no lastUpdated field');
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

    console.log('[iPOS Playwright] Successfully fetched dashboard data:', dashboardData);

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[iPOS Playwright] Error in /api/pos/dashboard:', error);

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
