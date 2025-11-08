# iPOS Direct API Integration Guide

**Last Updated:** November 8, 2025
**Status:** ✅ Successfully replaced Playwright with direct API calls

## Overview

We've successfully replaced the Playwright-based iPOS integration with direct API calls to `posapi.ipos.vn`. This approach is much more efficient and doesn't require browser automation.

## Key Findings

### The Working API
- **Base URL:** `https://posapi.ipos.vn` (NOT `fabi.ipos.vn`)
- **Authentication:** Requires BOTH tokens:
  - `access_token`: 32-character hexadecimal token
  - `authorization`: JWT bearer token
- **Headers Required:**
  - `access_token`: Your 32-char hex token
  - `authorization`: Your JWT bearer token
  - `fabi_type`: `pos-cms`
  - `x-client-timezone`: `25200000` (Vietnam +7 hours)
  - `accept-language`: `vi`
  - `referer`: `https://fabi.ipos.vn/`

### Why fabi.ipos.vn Doesn't Work
The `fabi.ipos.vn` website uses server-side rendering and returns HTML instead of JSON. However, when you log into the dashboard, it makes client-side API calls to `posapi.ipos.vn` with an access token.

## Setup Instructions

### Step 1: Get Your Access Token

Run the token capture script:

```bash
node scripts/get-ipos-access-token.js
```

This will:
1. Open a browser
2. Log into fabi.ipos.vn using your credentials
3. Capture the access_token from API calls
4. Display the token for you to copy

### Step 2: Configure Environment Variables

Add BOTH tokens to your `.env` file:

```bash
# iPOS Direct API Configuration
IPOS_API_BASE_URL=https://posapi.ipos.vn
IPOS_ACCESS_TOKEN=your_32_character_hex_token_here
IPOS_AUTH_TOKEN=your_jwt_bearer_token_here
IPOS_BRAND_UID=32774afe-fd5c-4028-b837-f91837c0307c
IPOS_COMPANY_UID=8a508e04-440f-4145-9429-22b7696c6193
IPOS_STORE_UID=72a800a6-1719-4b4b-9065-31ab2e0c07e5
```

**Important:** Both tokens are required for the API to work!

### Step 3: Test the API

Test that everything works:

```bash
# Test the direct API endpoint
curl http://localhost:3000/api/pos/test

# Get dashboard data
curl http://localhost:3000/api/pos/dashboard
```

## API Endpoints

### GET /api/pos/dashboard
Returns current POS data:
```json
{
  "success": true,
  "data": {
    "unpaidAmount": 425703,
    "paidAmount": 1234567,
    "currentTables": 5,
    "currentCustomers": 12,
    "lastUpdated": "2025-11-08T10:00:00Z"
  },
  "timestamp": "2025-11-08T10:00:00Z",
  "cached": false
}
```

### GET /api/pos/test
Tests the API connection and returns diagnostic information.

## Implementation Details

### Service Layer (`lib/services/ipos-api-service.ts`)

```typescript
// Key function that makes the API call
async function getSaleSummaryOverview(startDate: number, endDate: number) {
  const url = new URL(`${IPOS_BASE_URL}/api/v1/reports/sale-summary/overview`);

  // Add required query parameters
  url.searchParams.append('brand_uid', IPOS_BRAND_UID);
  url.searchParams.append('company_uid', IPOS_COMPANY_UID);
  url.searchParams.append('list_store_uid', IPOS_STORE_UID);
  url.searchParams.append('start_date', startDate.toString());
  url.searchParams.append('end_date', endDate.toString());
  url.searchParams.append('store_open_at', '10'); // Store opens at 10 AM

  const response = await fetch(url.toString(), {
    headers: {
      'access_token': IPOS_ACCESS_TOKEN,
      'fabi_type': 'pos-cms',
      'x-client-timezone': '25200000',
      'accept-language': 'vi',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  return response.json();
}
```

### API Route (`app/api/pos/dashboard/route.ts`)

The dashboard route now:
1. Uses direct API calls instead of Playwright
2. Implements 5-minute caching to reduce API calls
3. Returns stale cache on errors for resilience
4. Provides clear error messages if token not configured

## Data Mapping

The API returns data in this structure:
```javascript
{
  data: {
    revenue_net: 1234567,        // Today's NET revenue (paid amount)
    sale_tracking: {
      total_amount: 425703,       // Current unpaid amount
      table_count: 5,             // Active tables
      people_count: 12            // Current customers
    }
  }
}
```

## Advantages Over Playwright

1. **Performance:** ~100ms response vs 5-10 seconds with Playwright
2. **Reliability:** No browser crashes or timeouts
3. **Resource Usage:** Minimal CPU/memory vs full browser instance
4. **Deployment:** No need for Playwright dependencies in Docker
5. **Scalability:** Can handle concurrent requests easily

## Token Management

### Token Expiration
- Access tokens appear to be long-lived (no expiration observed yet)
- If token expires, run `scripts/get-ipos-access-token.js` again

### Security Best Practices
- Never commit the access token to git
- Use environment variables only
- Consider using a secrets management service in production

## Troubleshooting

### Token Not Working?
1. Verify token is exactly 32 hex characters
2. Check token doesn't have spaces or newlines
3. Try capturing a fresh token

### API Returns HTML?
- Make sure you're using `posapi.ipos.vn`, not `fabi.ipos.vn`
- Verify all required headers are present
- Check that the access_token header is set

### No Data Returned?
- The store day runs from 10 AM to 9:59 AM next day
- Check the date range parameters
- Verify store UIDs match your account

## Migration Checklist

- [x] Created direct API service (`ipos-api-service.ts`)
- [x] Created token capture script
- [x] Updated dashboard route to use API service
- [x] Tested API endpoints
- [x] Added caching layer
- [x] Documented setup process
- [ ] Remove Playwright dependencies (when ready)
- [ ] Update production environment variables

## Files to Remove (After Confirmation)

Once the direct API is working in production:
1. `lib/services/ipos-playwright-service.ts` - No longer needed
2. `capture-headers.js` - Replaced by better script
3. `capture-full-request.js` - Replaced by better script
4. `get-fresh-token.js` - Replaced by comprehensive script
5. Playwright dependencies from `package.json`

## Next Steps

1. Get the access token using the script
2. Configure environment variables
3. Test the endpoints
4. Deploy to staging
5. Monitor for any issues
6. Deploy to production
7. Remove Playwright code and dependencies

## Support

If you encounter issues:
1. Check token is valid and properly formatted
2. Review API response logs
3. Try capturing a fresh token
4. Check network connectivity to posapi.ipos.vn