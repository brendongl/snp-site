# iPOS (Fabi POS) API Endpoints Reference

**Last Updated:** October 30, 2025
**Base URL:** `https://fabi.ipos.vn/api`
**Authentication:** Bearer Token (JWT)

---

## ⚠️ CRITICAL FINDING: APIs DO NOT WORK

**Date Tested:** October 30, 2025

After extensive testing using multiple authentication methods, **all documented API endpoints return HTML instead of JSON**, making them unusable for programmatic access.

### What Was Tested
✅ Valid JWT token from localStorage
✅ All browser cookies and session data
✅ Authenticated browser context (Playwright)
✅ Multiple endpoint variations
❌ **ALL endpoints return `200 OK` with HTML (login page)**

### Endpoints That Don't Work
```
❌ /api/v3/pos-cms/sale-tracking?date=YYYY-MM-DD
❌ /api/v1/reports/sale-summary/overview?from_date=X&to_date=Y
❌ /api/pos/v1/reports/sale-summary/overview?from_date=X&to_date=Y
❌ /api/pos/v1/reports/overview?from_date=X&to_date=Y
❌ /api/pos-cms/v1/dashboard?date=YYYY-MM-DD
```

Even when called FROM WITHIN an authenticated browser session with a valid token, these endpoints return the HTML login page.

### How Dashboard Actually Loads Data

The dashboard (`https://fabi.ipos.vn/dashboard`) uses **server-side rendering**. The financial data is embedded in the initial HTML response, not fetched via API calls.

### Working Solution: HTML Scraping

Since APIs don't work, you MUST:

1. **Login via browser automation** (Playwright/Puppeteer)
   - URL: `https://fabi.ipos.vn/login`
   - Email field: `input[name="email_input"]`
   - Password field: `input[type="password"]`
   - Submit: `button:has-text("Đăng nhập")`

2. **Navigate to dashboard**: `https://fabi.ipos.vn/dashboard`

3. **Extract data from HTML**:
   - **Paid Amount (Revenue)**: Pattern `/(\d{1,3}(?:,\d{3})*)\s*₫/` in "Doanh thu (NET)" section
   - **Unpaid Amount**: Pattern `/Tổng tiền chưa thanh toán\s+([\d,]+)/`
   - **Tables**: Pattern `/Có\s+(\d+)\s+bàn\s+\/\s+(\d+)\s+bàn/`
   - **Customers**: Pattern `/Tổng:\s+(\d+)\s+khách/`

### Example Implementation

See `lib/services/ipos-playwright-service.ts` for a working implementation using Playwright to:
- Log in with credentials from environment variables
- Extract dashboard data
- Cache results for 5 minutes

**Environment Variables Required**:
```bash
IPOS_EMAIL=sipnplay@ipos.vn
IPOS_PASSWORD=your_password_here
```

---

## Original API Documentation (Non-Functional)

⚠️ The following documentation describes endpoints that **do not work**. It is preserved for reference only.

---

## Authentication

All API requests require authentication using a Bearer token stored in localStorage.

```javascript
// Get token from localStorage
const token = localStorage.getItem('token');

// Example request
fetch('https://fabi.ipos.vn/api/v3/pos-cms/sale-tracking?date=2025-10-26', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});
```

### Your Current Token
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFkNGY4ZDkwLTRjZWEtNDY5ZC1iMzE1LTZhZWY0NjU4MDExNyIsInV0IjoiODA1ZThjOTQtZmUwOS00MGU0LWI0MzktMmExZTNlYTM1YjRmIiwiZW1haWwiOiJzaXBucGxheUBpcG9zLnZuIiwiaWF0IjoxNzYxNDU0NDA2LCJleHAiOjE3NjIwNTkyMDZ9.WsWfN9HdegKrbuj7NWVjMIhI4GHx9sxC-VLFuvp9R7k
```

**Note:** This token will expire on: **January 3, 2026** (based on exp: 1762059206)

---

## Key Endpoints for Dashboard Data

### 1. Sale Tracking (Real-Time Data)
**PRIMARY ENDPOINT FOR YOUR DASHBOARD NEEDS**

```
GET /api/v3/pos-cms/sale-tracking
```

**Purpose:** Get current unpaid amount, table count, and customer count in real-time.

**Query Parameters:**
- `date` (required): Date in YYYY-MM-DD format (e.g., `2025-10-26`)
- `store_id` (optional): Filter by specific store

**Response Data:**
```json
{
  "total_unpaid_amount": 425703,
  "current_tables": 1,
  "current_customers": 0,
  "timestamp": "2025-10-26T11:56:42Z"
}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://fabi.ipos.vn/api/v3/pos-cms/sale-tracking?date=2025-10-26"
```

---

### 2. Sale Tracking Detail
```
GET /api/v1/reports/sales/sale-tracking/detail
```

**Purpose:** Get detailed breakdown of current sales tracking data.

**Query Parameters:**
- `date`: Date in YYYY-MM-DD format
- `store_id`: Store identifier

---

## Revenue & Sales Endpoints

### Overview Data
```
GET /api/v1/reports/sale-summary/overview
```
**Purpose:** Get NET revenue, bill count, customer count, and summary statistics.

**Query Parameters:**
- `from_date`: Start date (YYYY-MM-DD)
- `to_date`: End date (YYYY-MM-DD)
- `store_ids`: Comma-separated store IDs

**Response Includes:**
- Net revenue
- Total bills
- Total customers
- Average per bill
- Average per customer
- Discounts and costs

---

### Top Items
```
GET /api/v1/reports/sale-summary/items
```
**Purpose:** Get top-selling items by revenue or quantity.

**Query Parameters:**
- `from_date`: Start date
- `to_date`: End date
- `store_ids`: Store filter
- `sort_by`: `revenue_net`, `quantity`, or `revenue_gross`
- `limit`: Number of results (default: 5)

---

### Promotions
```
GET /api/v1/reports/sale-summary/promotions
```
**Purpose:** Get top promotions by revenue.

**Query Parameters:**
- `from_date`: Start date
- `to_date`: End date
- `store_ids`: Store filter

---

### Sources (Dine-in, Takeaway, Delivery)
```
GET /api/v1/reports/sale-summary/sources
```
**Purpose:** Get revenue by sale source (TẠI CHỖ, O2O, MANG VỀ).

---

### Payment Methods
```
GET /api/v1/reports/sale-summary/payment-methods
```
**Purpose:** Get revenue breakdown by payment method (CASH, CREDIT CARD, TRANSFER).

**Response Includes:**
- Payment method name
- Total amount
- Percentage of total

---

### Stores
```
GET /api/v1/reports/sale-summary/stores
```
**Purpose:** Get revenue by store.

---

## Accounting Reports

### Payment Method Report
```
GET /api/v1/accounting/report/payment-method
```

### Sale Report
```
GET /api/v1/accounting/report/sale
```

### Sale Detail Report
```
GET /api/v1/accounting/report/sale-detail
```

### Sale Grouped by Day
```
GET /api/v1/accounting/report/sale-group-by-day
```

---

## Time-Based Reports

### Revenue by Days
```
GET /api/v1/reports/sale-summary/days
```
**Purpose:** Get revenue for the last N days.

**Query Parameters:**
- `from_date`: Start date
- `to_date`: End date
- `store_ids`: Store filter

---

### Revenue by Hours
```
GET /api/v1/reports/sale-summary/hours
```
**Purpose:** Get revenue breakdown by hour of day.

---

### Revenue by Weekdays
```
GET /api/v1/reports/sale-summary/weekdays
```
**Purpose:** Get revenue trends by day of week.

---

### Sale Trend by Hour
```
GET /api/v3/pos-cms/report/sale-trend-by-hour
```

---

## Control Reports (C-Series)

### C01 - General Report
```
GET /api/v3/pos-cms/report/general
```

### C02 - Shift Report
```
GET /api/v1/reports/shifts
GET /api/v3/pos-cms/shift (for detail)
```

### C03 - Sale by Date
```
GET /api/v3/pos-cms/sale
```

### C04 - Sale Change Log
```
GET /api/v3/pos-cms/sale-change-log
```

### C05 - Sale Edit/Delete
```
GET /api/v3/pos-cms/report/sale-edit-delete
```

### C06 - Sale Change After Print Check List
```
GET /api/v3/pos-cms/report/sale-change-after-print-check-list
```

### C07 - Dine-in Sale Tracking
```
GET /api/v3/pos-cms/sale-tracking
```

### C08 - Items Removed Report
```
GET /api/v3/pos-cms/report/sale-change-log-remove-item
```

### C09 - Out of Stock History
```
GET /api/v3/pos-cms/report/out-of-stock-item
```

### C12 - Deposit Report
```
GET /api/v1/deposit/days
GET /api/v1/deposit/items
```

---

## Table & Area Reports

### Sale by Table
```
GET /api/v3/pos-cms/report/sale-by-table
```

### Sale by Area
```
GET /api/v1/reports/sales/get-sale-by-area
GET /api/v3/pos-cms/report/sale-by-area
```

---

## Detailed Sale Data

### Get Sale by Transaction ID
```
GET /api/v1/reports/sales/get-sale-by-tran-id
GET /api/v3/pos-cms/get-sale-by-list-tran-id
```

### Get Sale by Shift ID
```
GET /api/v3/pos-cms/get-sale-by-shift-id
```

---

## Common Query Parameters

Most endpoints support these common parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | string | Single date (YYYY-MM-DD) |
| `from_date` | string | Start date for range |
| `to_date` | string | End date for range |
| `store_ids` | string | Comma-separated store IDs |
| `store_id` | string | Single store ID |
| `sort_by` | string | Sort field (varies by endpoint) |
| `limit` | number | Number of results to return |

---

## Response Format

Most endpoints return JSON in this general format:

```json
{
  "success": true,
  "data": {
    // Response data varies by endpoint
  },
  "message": "Success",
  "timestamp": "2025-10-26T12:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

---

## Integration Example for Sip & Play Website

Here's how to fetch the dashboard data for your website:

```javascript
// lib/services/ipos-service.ts
const IPOS_BASE_URL = 'https://fabi.ipos.vn/api';
const IPOS_TOKEN = process.env.IPOS_API_TOKEN;

export async function getCurrentPOSStats() {
  const today = new Date().toISOString().split('T')[0];

  const response = await fetch(
    `${IPOS_BASE_URL}/v3/pos-cms/sale-tracking?date=${today}`,
    {
      headers: {
        'Authorization': `Bearer ${IPOS_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`iPOS API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    totalUnpaidAmount: data.total_unpaid_amount || 0,
    currentTables: data.current_tables || 0,
    currentCustomers: data.current_customers || 0,
    lastUpdated: new Date().toISOString()
  };
}

export async function getDashboardOverview(fromDate: string, toDate: string) {
  const response = await fetch(
    `${IPOS_BASE_URL}/v1/reports/sale-summary/overview?from_date=${fromDate}&to_date=${toDate}`,
    {
      headers: {
        'Authorization': `Bearer ${IPOS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.json();
}
```

---

## Rate Limiting

**Unknown** - Monitor API responses for rate limit headers.

---

## Notes

1. **Token Expiration:** Tokens expire after a certain period. Monitor the `exp` field in the JWT payload.
2. **Date Format:** Always use `YYYY-MM-DD` format for dates.
3. **Store IDs:** Your store ID is likely tied to "SIPNPLAY" (visible in the dashboard).
4. **Real-Time Data:** The `/sale-tracking` endpoint provides the freshest data for current operations.
5. **Historical Limit:** Sale tracking data is only stored for the last 30 days.

---

## Environment Variables

Add these to your `.env` file:

```bash
# iPOS API Configuration
IPOS_API_BASE_URL=https://fabi.ipos.vn/api
IPOS_API_TOKEN=your_token_here
IPOS_STORE_ID=your_store_id
```

---

## Next Steps

1. **Test Endpoints:** Use curl or Postman to test each endpoint
2. **Create Service Layer:** Build a service class in `/lib/services/ipos-service.ts`
3. **Create API Route:** Add `/api/pos/dashboard` endpoint in your Next.js app
4. **Build UI Component:** Create dashboard widget to display POS data
5. **Add Caching:** Cache POS data for 1-5 minutes to reduce API calls
6. **Error Handling:** Implement graceful degradation if POS API is unavailable

---

**Questions or Issues?**
- Check the iPOS documentation: https://fabi-docs.ipos.vn/
- Contact iPOS support if you need additional API access
