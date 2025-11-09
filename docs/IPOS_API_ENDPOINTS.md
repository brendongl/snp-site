# iPOS (Fabi POS) API Endpoints Reference

**Last Updated:** November 8, 2025
**Base URL:** `https://posapi.ipos.vn` (NOT `fabi.ipos.vn`)
**Status:** ✅ WORKING - Direct API calls successful

---

## ✅ SOLUTION: Direct API Works!

**Date Verified:** November 8, 2025

After extensive research, we discovered the working API at `posapi.ipos.vn` that accepts direct server-to-server calls without CORS issues.

### Authentication Requirements

The API requires **BOTH** tokens in the headers:
1. **`access_token`**: 32-character hexadecimal token
2. **`authorization`**: JWT bearer token

Both tokens can be captured using the script: `node scripts/get-ipos-access-token.js`

### Working Endpoint

```
GET https://posapi.ipos.vn/api/v1/reports/sale-summary/overview
```

**Query Parameters:**
- `brand_uid`: 32774afe-fd5c-4028-b837-f91837c0307c
- `company_uid`: 8a508e04-440f-4145-9429-22b7696c6193
- `list_store_uid`: 72a800a6-1719-4b4b-9065-31ab2e0c07e5
- `start_date`: Timestamp in milliseconds
- `end_date`: Timestamp in milliseconds
- `store_open_at`: 10 (store opens at 10 AM)

**Required Headers:**
```javascript
{
  'access_token': '32_char_hex_token',
  'authorization': 'jwt_bearer_token',
  'fabi_type': 'pos-cms',
  'x-client-timezone': '25200000',
  'accept-language': 'vi',
  'referer': 'https://fabi.ipos.vn/',
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

### Response Format

```json
{
  "data": {
    "revenue_net": 9665372,        // Today's NET revenue (paid amount)
    "total_sales": 25,              // Number of bills
    "peo_count": 0,                 // Number of customers
    "sale_tracking": {
      "table_count": 10,            // Active tables
      "people_count": 0,            // Current customers in store
      "total_amount": 4529555,      // Current unpaid amount
      "table_total": 10
    }
  }
}
```

---

## Implementation

### Service Layer
See `lib/services/ipos-api-service.ts` for the complete implementation using direct API calls.

### API Endpoint
Access via: `GET /api/pos/dashboard`

### Environment Variables Required

```bash
# iPOS Direct API Configuration
IPOS_ACCESS_TOKEN=your_32_character_hex_token  # Get via script
IPOS_AUTH_TOKEN=your_jwt_bearer_token         # Get via script
IPOS_BRAND_UID=32774afe-fd5c-4028-b837-f91837c0307c
IPOS_COMPANY_UID=8a508e04-440f-4145-9429-22b7696c6193
IPOS_STORE_UID=72a800a6-1719-4b4b-9065-31ab2e0c07e5
```

---

## Authentication Options

### Option 1: Automatic Authentication (NEW - Recommended)
The application now handles authentication automatically. Just set your credentials:

```bash
# Add to .env - tokens will be fetched automatically
IPOS_EMAIL=sipnplay@ipos.vn
IPOS_PASSWORD=123123A
```

The system will:
- Automatically login when needed
- Cache tokens for reuse (in `/tmp/ipos-tokens.json`)
- Refresh tokens before they expire
- Retry failed requests with fresh tokens

### Option 2: Manual Token Configuration
You can still manually provide tokens if preferred:

```bash
# Manual tokens in .env
IPOS_ACCESS_TOKEN=c3f4a5b6d7e8f9a0b1c2d3e4f5a6b7c8
IPOS_AUTH_TOKEN=eyJ0eXAiOiJKV1QiLCJhb...
```

### Option 3: Capture Tokens from Browser
Use the capture script to get tokens from browser session:

```bash
node scripts/get-ipos-access-token.js
```

This will:
1. Open a browser and log into Fabi dashboard
2. Capture both required tokens from API calls
3. Display them for you to copy to `.env`

---

## Testing the API

### Direct Test
```bash
node test-ipos-direct-api.js
```

### Via Development Server
```bash
npm run dev
curl http://localhost:3000/api/pos/dashboard
```

---

## Performance Comparison

| Method | Response Time | Resource Usage | Reliability |
|--------|--------------|----------------|-------------|
| Direct API | ~100ms | Minimal | High |
| Playwright | 5-10 seconds | Full browser | Medium |

**Result: 50-100x faster with direct API!**

---

## Why fabi.ipos.vn Doesn't Work

The `fabi.ipos.vn` domain uses server-side rendering and returns HTML instead of JSON. However, the dashboard makes client-side API calls to `posapi.ipos.vn` which we can replicate directly from our server.

---

## Other Available Endpoints

Based on captured network traffic, these endpoints are also available:

- `/api/v1/reports/sale-summary/promotions`
- `/api/v1/reports/sale-summary/sources`
- `/api/v1/reports/sale-summary/payment-methods`
- `/api/v1/reports/sale-summary/stores`
- `/api/v1/reports/sale-summary/items`
- `/api/v1/reports/sale-summary/weekdays`
- `/api/v3/pos-cms/notification`
- `/api/invoice/v1/count/remaining_invoice`

All require the same authentication headers as described above.

---

## Support

For issues or questions:
1. Check token validity (both access_token and auth_token required)
2. Verify environment variables are set correctly
3. Run `node test-ipos-direct-api.js` to test connection
4. Review logs in console for detailed error messages