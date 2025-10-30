// app/api/pos/dashboard/route.ts
import { NextResponse } from 'next/server';
// TEMPORARILY DISABLED: Playwright import causing build issues
// import { fetchIPOSDashboardData, getIPOSCredentials } from '@/lib/services/ipos-playwright-service';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  // TEMPORARILY DISABLED: iPOS Playwright integration
  // This feature will be re-enabled after fixing the build configuration
  return NextResponse.json({
    success: false,
    error: 'iPOS dashboard feature temporarily disabled',
    data: {
      unpaidAmount: 0,
      paidAmount: 0,
      currentTables: 0,
      currentCustomers: 0,
      lastUpdated: new Date().toISOString()
    }
  }, { status: 503 });

  /* ORIGINAL CODE - TO BE RE-ENABLED:
  try {
    // Get credentials from environment
    const credentials = getIPOSCredentials();

    if (!credentials) {
      console.error('[iPOS API] Credentials not configured');
      return NextResponse.json({
        success: false,
        error: 'iPOS credentials not configured in environment',
        data: {
          unpaidAmount: 0,
          paidAmount: 0,
          currentTables: 0,
          currentCustomers: 0,
          lastUpdated: new Date().toISOString()
        }
      }, { status: 500 });
    }

    // Fetch data using Playwright (scrapes dashboard HTML)
    const dashboardData = await fetchIPOSDashboardData(credentials);

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in /api/pos/dashboard:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch POS dashboard data',
      data: {
        unpaidAmount: 0,
        paidAmount: 0,
        currentTables: 0,
        currentCustomers: 0,
        lastUpdated: new Date().toISOString()
      }
    }, { status: 500 });
  }
  */
}
