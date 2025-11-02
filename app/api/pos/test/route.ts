// app/api/pos/test/route.ts
// Test endpoint to verify iPOS API connection works
import { NextResponse } from 'next/server';
import { getCurrentDashboardData, getYesterdayRevenue, formatVND } from '@/lib/services/ipos-api-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[iPOS Test] Starting API test...');

    // Test 1: Get current dashboard data
    const currentData = await getCurrentDashboardData();

    // Test 2: Get yesterday's revenue
    const yesterdayRevenue = await getYesterdayRevenue();

    const testResults = {
      success: true,
      timestamp: new Date().toISOString(),
      message: 'iPOS API test completed',
      tests: {
        currentDashboardData: {
          status: currentData.unpaidAmount >= 0 ? 'PASS' : 'FAIL',
          data: currentData,
          formatted: {
            unpaidAmount: `${formatVND(currentData.unpaidAmount)} VND`,
            paidAmount: `${formatVND(currentData.paidAmount)} VND`,
            currentTables: currentData.currentTables,
            currentCustomers: currentData.currentCustomers
          }
        },
        yesterdayRevenue: {
          status: yesterdayRevenue >= 0 ? 'PASS' : 'FAIL',
          data: yesterdayRevenue,
          formatted: `${formatVND(yesterdayRevenue)} VND`
        }
      },
      environmentCheck: {
        hasBaseUrl: !!process.env.IPOS_API_BASE_URL,
        hasAccessToken: !!process.env.IPOS_ACCESS_TOKEN,
        accessTokenFormat: process.env.IPOS_ACCESS_TOKEN?.length === 32 ? 'hex (correct)' : 'invalid',
        baseUrl: process.env.IPOS_API_BASE_URL || 'https://posapi.ipos.vn',
        brandUid: process.env.IPOS_BRAND_UID || '32774afe-fd5c-4028-b837-f91837c0307c',
        companyUid: process.env.IPOS_COMPANY_UID || '8a508e04-440f-4145-9429-22b7696c6193',
        storeUid: process.env.IPOS_STORE_UID || '72a800a6-1719-4b4b-9065-31ab2e0c07e5'
      }
    };

    console.log('[iPOS Test] Results:', JSON.stringify(testResults, null, 2));

    return NextResponse.json(testResults);

  } catch (error) {
    console.error('[iPOS Test] Error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
