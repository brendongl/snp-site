// lib/services/ipos-api-service.ts
// iPOS API Service using the CORRECT API endpoint (posapi.ipos.vn)
// IMPORTANT: Requires BOTH access_token (hex) AND authorization (JWT) headers

const IPOS_BASE_URL = process.env.IPOS_API_BASE_URL || 'https://posapi.ipos.vn';
const IPOS_ACCESS_TOKEN = process.env.IPOS_ACCESS_TOKEN; // 32-char hex token
const IPOS_AUTH_TOKEN = process.env.IPOS_AUTH_TOKEN; // JWT bearer token
const IPOS_BRAND_UID = process.env.IPOS_BRAND_UID || '32774afe-fd5c-4028-b837-f91837c0307c';
const IPOS_COMPANY_UID = process.env.IPOS_COMPANY_UID || '8a508e04-440f-4145-9429-22b7696c6193';
const IPOS_STORE_UID = process.env.IPOS_STORE_UID || '72a800a6-1719-4b4b-9065-31ab2e0c07e5';
const STORE_OPEN_HOUR = 10; // Store opens at 10 AM
const CLIENT_TIMEZONE = 25200000; // +7 hours in milliseconds (Vietnam timezone)

export interface IPOSApiResponse {
  data: {
    revenue_net: number;              // NET REVENUE (today's/yesterday's revenue)
    discount_amount: number;
    total_sales: number;              // Number of bills
    peo_count: number;                // Number of customers
    sale_tracking: {
      table_count: number;            // Active tables
      people_count: number;           // Number of customers
      total_amount: number;           // CURRENT UNPAID AMOUNT
      table_total: number;
    };
  };
}

export interface POSDashboardData {
  unpaidAmount: number;
  paidAmount: number;
  currentTables: number;
  currentCustomers: number;
  lastUpdated: string;
}

/**
 * Get sale summary overview from iPOS API
 * This endpoint answers all questions:
 * - Current unpaid amount: data.sale_tracking.total_amount
 * - Total revenue for today: data.revenue_net (with today's date range)
 * - Total revenue yesterday: data.revenue_net (with yesterday's date range)
 */
async function getSaleSummaryOverview(startDate: number, endDate: number): Promise<IPOSApiResponse | null> {
  if (!IPOS_ACCESS_TOKEN || !IPOS_AUTH_TOKEN) {
    console.warn('[iPOS API] Both access_token and auth_token are required');
    console.warn('[iPOS API] Access token:', IPOS_ACCESS_TOKEN ? 'configured' : 'missing');
    console.warn('[iPOS API] Auth token:', IPOS_AUTH_TOKEN ? 'configured' : 'missing');
    return null;
  }

  try {
    const url = new URL(`${IPOS_BASE_URL}/api/v1/reports/sale-summary/overview`);
    url.searchParams.append('brand_uid', IPOS_BRAND_UID);
    url.searchParams.append('company_uid', IPOS_COMPANY_UID);
    url.searchParams.append('list_store_uid', IPOS_STORE_UID);
    url.searchParams.append('start_date', startDate.toString());
    url.searchParams.append('end_date', endDate.toString());
    url.searchParams.append('store_open_at', STORE_OPEN_HOUR.toString());

    console.log('[iPOS API] Fetching:', url.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'access_token': IPOS_ACCESS_TOKEN,
        'authorization': IPOS_AUTH_TOKEN, // JWT bearer token
        'fabi_type': 'pos-cms',
        'x-client-timezone': CLIENT_TIMEZONE.toString(),
        'accept-language': 'vi',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'referer': 'https://fabi.ipos.vn/'
      },
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
      console.error(`[iPOS API] HTTP ${response.status}: ${response.statusText}`);
      const text = await response.text();
      console.error(`[iPOS API] Response body:`, text.substring(0, 500));
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`[iPOS API] Expected JSON, got: ${contentType}`);
      const text = await response.text();
      console.error(`[iPOS API] Response body:`, text.substring(0, 500));
      return null;
    }

    const data = await response.json();
    console.log('[iPOS API] Success! Received data:', JSON.stringify(data, null, 2));
    return data;

  } catch (error) {
    console.error('[iPOS API] Error fetching sale summary:', error);
    return null;
  }
}

/**
 * Get timestamp in milliseconds for a given date at store opening time (10 AM)
 */
function getStoreOpeningTimestamp(date: Date): number {
  const d = new Date(date);
  d.setHours(STORE_OPEN_HOUR, 0, 0, 0);
  return d.getTime();
}

/**
 * Get current dashboard data (unpaid amount, revenue, tables, customers)
 */
export async function getCurrentDashboardData(): Promise<POSDashboardData> {
  const now = new Date();

  // Store day runs from 10:00 AM today to 9:59 AM tomorrow
  const startDate = getStoreOpeningTimestamp(now);
  const endDate = getStoreOpeningTimestamp(new Date(now.getTime() + 24 * 60 * 60 * 1000)) - 1;

  console.log('[iPOS API] Fetching current dashboard data...');
  console.log('[iPOS API] Start date:', new Date(startDate).toISOString());
  console.log('[iPOS API] End date:', new Date(endDate).toISOString());

  const result = await getSaleSummaryOverview(startDate, endDate);

  if (!result) {
    console.warn('[iPOS API] Failed to fetch data, returning zeros');
    return {
      unpaidAmount: 0,
      paidAmount: 0,
      currentTables: 0,
      currentCustomers: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  return {
    unpaidAmount: result.data.sale_tracking.total_amount || 0,
    paidAmount: result.data.revenue_net || 0,
    currentTables: result.data.sale_tracking.table_count || 0,
    currentCustomers: result.data.sale_tracking.people_count || 0,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Get yesterday's revenue
 */
export async function getYesterdayRevenue(): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const startDate = getStoreOpeningTimestamp(yesterday);
  const endDate = getStoreOpeningTimestamp(new Date()) - 1;

  const result = await getSaleSummaryOverview(startDate, endDate);
  return result?.data.revenue_net || 0;
}

/**
 * Format VND currency
 */
export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount);
}
