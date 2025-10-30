// lib/services/ipos-service.ts
// iPOS (Fabi POS) API Service Layer
// Provides methods to fetch real-time POS data for dashboard display

const IPOS_BASE_URL = process.env.IPOS_API_BASE_URL || 'https://fabi.ipos.vn/api';
const IPOS_TOKEN = process.env.IPOS_API_TOKEN;

export interface POSSaleTrackingData {
  total_unpaid_amount: number;
  current_tables: number;
  current_customers: number;
  timestamp: string;
}

export interface POSOverviewData {
  revenue_net: number;
  total_bills: number;
  total_customers: number;
  average_per_bill: number;
  average_per_customer: number;
}

export interface POSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  currentCustomers: number;
  lastUpdated: string;
}

/**
 * Get current unpaid amount and table/customer counts
 * Fetches from /api/v3/pos-cms/sale-tracking
 */
async function getSaleTrackingData(date: string): Promise<POSSaleTrackingData | null> {
  if (!IPOS_TOKEN) {
    console.warn('iPOS API token not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${IPOS_BASE_URL}/v3/pos-cms/sale-tracking?date=${date}`,
      {
        headers: {
          'Authorization': `Bearer ${IPOS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        next: { revalidate: 60 } // Cache for 1 minute
      }
    );

    if (!response.ok) {
      console.error(`iPOS sale-tracking API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching iPOS sale tracking data:', error);
    return null;
  }
}

/**
 * Get revenue/sales overview for a date range
 * Fetches from /api/v1/reports/sale-summary/overview
 */
async function getOverviewData(fromDate: string, toDate: string): Promise<POSOverviewData | null> {
  if (!IPOS_TOKEN) {
    console.warn('iPOS API token not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${IPOS_BASE_URL}/v1/reports/sale-summary/overview?from_date=${fromDate}&to_date=${toDate}`,
      {
        headers: {
          'Authorization': `Bearer ${IPOS_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    );

    if (!response.ok) {
      console.error(`iPOS overview API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching iPOS overview data:', error);
    return null;
  }
}

/**
 * Get complete dashboard data for admin header
 * Combines sale tracking (unpaid) and overview (paid/revenue) data
 */
export async function getDashboardData(): Promise<POSDashboardData> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Fetch both endpoints in parallel
  const [saleTracking, overview] = await Promise.all([
    getSaleTrackingData(today),
    getOverviewData(today, today)
  ]);

  return {
    unpaidAmount: saleTracking?.total_unpaid_amount || 0,
    paidAmount: overview?.revenue_net || 0,
    currentTables: saleTracking?.current_tables || 0,
    currentCustomers: saleTracking?.current_customers || 0,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Format VND currency
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}
