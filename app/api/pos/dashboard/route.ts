// app/api/pos/dashboard/route.ts
import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/services/ipos-service';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  try {
    const dashboardData = await getDashboardData();

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
}
