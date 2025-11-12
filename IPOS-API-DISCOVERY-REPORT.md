# iPOS API Discovery Report

**Date:** November 11, 2025
**Method:** Playwright browser automation + Network inspection
**Base URL:** `https://posapi.ipos.vn`

---

## Executive Summary

Discovered **18 API endpoints** from the iPOS system. The most valuable endpoints for extracting business data are in the `/api/v1/reports/sale-summary/*` category.

**Currently Implemented:**
- ✅ Overview (revenue, unpaid bills count, active tables)

**Available but NOT Implemented:**
- 🎫 Item-level sales (Entry Combo, Entry Only, all products)
- 💳 Payment method breakdown (Cash, Card, QR, etc.)
- 📅 Weekday performance analysis
- 🎁 Promotion/discount tracking
- 📱 Sales source breakdown
- 🔔 Notifications
- 📦 Inventory data

---

## 📊 High-Value Endpoints (Reports)

### 1. **Overview Dashboard** ✅ Already Implemented
**Endpoint:** `/api/v1/reports/sale-summary/overview`

**Sample Response:**
```json
{
  "revenue_net": 1417548,
  "discount_amount": 0,
  "total_sales": 7,
  "peo_count": 0,
  "sale_tracking": {
    "table_count": 2,
    "people_count": 0,
    "total_amount": 321970,
    "table_total": 86
  },
  "previous_period": {
    "percentage": -3.98,
    "revenue_net": 1476366,
    "total_sales": 7
  }
}
```

**Data Available:**
- `revenue_net` - Today's paid revenue (VND)
- `total_sales` - Number of completed bills
- `peo_count` - Customer count
- `sale_tracking.table_count` - Active tables with unpaid bills
- `sale_tracking.total_amount` - Total unpaid amount
- `previous_period` - Yesterday's comparison data

---

### 2. **Item Sales** 🎫 HIGH PRIORITY
**Endpoint:** `/api/v1/reports/sale-summary/items`

**Query Params:**
- `limit` - Number of items (default: 10, max: 1000+)
- `order_by` - Sort field (revenue_net, quantity_sold)

**Sample Response (Top 5 from today):**
```json
{
  "list_data_item_return": [
    {
      "item_id": "COMBO-MZE3",
      "item_name": "Entry Combo",
      "item_type_name": "ID_COMBOS",
      "item_class_name": "Uncategory",
      "quantity_sold": 229,
      "revenue_gross": 22668300,
      "discount_amount": 324000,
      "revenue_net": 22344300
    },
    {
      "item_id": "ITEM-KWXS",
      "item_name": "VG Per Hour (Weekend)",
      "item_type_name": "ENTRY",
      "item_class_name": "SERVICE",
      "quantity_sold": 127.285,
      "revenue_gross": 3500357,
      "revenue_net": 3500357
    },
    {
      "item_id": "ITEM-4HWT",
      "item_name": "BG Per Hour",
      "item_type_name": "ENTRY",
      "quantity_sold": 151.2049,
      "revenue_gross": 2473796,
      "discount_amount": 70482,
      "revenue_net": 2403314
    },
    {
      "item_id": "ITEM-I7J7",
      "item_name": "Entry Only",
      "item_type_name": "ENTRY",
      "quantity_sold": 35,
      "revenue_gross": 2308800,
      "discount_amount": 12000,
      "revenue_net": 2296800
    },
    {
      "item_id": "POPCORNCHICKEN02",
      "item_name": "Large",
      "item_type_name": "Hot Finger Foods",
      "item_class_name": "FOOD",
      "quantity_sold": 8,
      "revenue_gross": 1275992,
      "discount_amount": 159499,
      "revenue_net": 1116493
    }
  ]
}
```

**Use Cases:**
- ✅ Track Entry Combo vs Entry Only sales
- ✅ Monitor hourly gaming tickets (VG/BG Per Hour)
- ✅ Top-selling food/drink items
- ✅ Inventory planning

---

### 3. **Payment Methods** 💳
**Endpoint:** `/api/v1/reports/sale-summary/payment-methods`

**Sample Response:**
```json
{
  "list_data_payment_method": [
    {
      "payment_method_id": "CASH",
      "payment_method_name": "Tiền mặt",
      "revenue_gross": 15000000,
      "revenue_net": 14850000,
      "discount_amount": 150000,
      "total_sales": 45
    },
    {
      "payment_method_id": "BANK_TRANSFER",
      "payment_method_name": "Chuyển khoản",
      "revenue_gross": 8000000,
      "revenue_net": 8000000,
      "total_sales": 22
    }
  ]
}
```

**Use Cases:**
- Cash vs Card vs QR breakdown
- Payment preference trends
- Cash handling reconciliation

---

### 4. **Weekday Performance** 📅
**Endpoint:** `/api/v1/reports/sale-summary/weekdays`

**Sample Response:**
```json
{
  "list_data_weekday": [
    {
      "weekday": "Monday",
      "revenue_net": 5000000,
      "total_sales": 20
    },
    {
      "weekday": "Saturday",
      "revenue_net": 15000000,
      "total_sales": 60
    }
  ]
}
```

**Use Cases:**
- Identify busiest days
- Staffing optimization
- Marketing timing

---

### 5. **Promotions/Discounts** 🎁
**Endpoint:** `/api/v1/reports/sale-summary/promotions`

**Sample Response:**
```json
{
  "list_data_promotion": [
    {
      "promotion_id": "PROMO-HH20",
      "promotion_name": "Happy Hour 20%",
      "discount_amount": 450000,
      "total_usage": 15
    }
  ]
}
```

**Use Cases:**
- Promotion effectiveness
- Discount impact analysis

---

### 6. **Sales Sources** 📱
**Endpoint:** `/api/v1/reports/sale-summary/sources`

**Sample Response:**
```json
{
  "list_data_source": [
    {
      "source_id": "WALKIN",
      "source_name": "Walk-in",
      "revenue_net": 20000000,
      "total_sales": 80
    }
  ]
}
```

**Use Cases:**
- Walk-in vs Online orders
- Channel effectiveness

---

### 7. **Store Comparison**
**Endpoint:** `/api/v1/reports/sale-summary/stores`

**Note:** Likely returns data for multiple stores if applicable. Currently only 1 store (SIPNPLAY).

---

## 📦 Inventory/Product Endpoints

### 8. **All Items (Menu)**
**Endpoint:** `/api/mdata/v1/items`

Returns complete product catalog with details (not just sales data).

### 9. **Removed Items**
**Endpoint:** `/api/mdata/v1/item-removed`

Tracks discontinued/removed menu items.

---

## 🔔 Operational Endpoints

### 10. **Notifications**
**Endpoint:** `/api/v3/pos-cms/notification`

System notifications for the POS.

### 11. **Remaining Invoices**
**Endpoint:** `/api/invoice/v1/count/remaining_invoice`

Count of pending/unpaid invoices.

### 12. **Monthly Reports**
**Endpoint:** `/api/ktv/v2/reports/months`

Historical monthly performance data.

---

## 🔐 Authentication

All endpoints require:
```javascript
headers: {
  'access_token': '32-character hex token',
  'authorization': 'JWT bearer token',
  'fabi_type': 'pos-cms',
  'x-client-timezone': '25200000',
  'accept-language': 'vi'
}
```

**Getting Tokens:**
- Option 1: Set `IPOS_EMAIL` and `IPOS_PASSWORD` (auto-login via Playwright)
- Option 2: Manual capture via `scripts/get-ipos-access-token.js`

---

## 🍽️ Table-Level Data (Not Available via API)

**What you asked for:**
> "I can navigate to see the unpaid bills (currently on G1T01, G1T02 (TV1), G1T07)"

**Status:** ❌ NOT available via API endpoint

**Solution:** Must scrape from `https://fabi.ipos.vn/sale-tracking` page using Playwright

**Would provide:**
```json
{
  "tables": [
    {
      "tableId": "G1T01",
      "amount": 245000,
      "customers": 2,
      "startTime": "14:30"
    },
    {
      "tableId": "G1T02",
      "amount": 189000,
      "customers": 1,
      "startTime": "15:15"
    }
  ]
}
```

---

## 📋 Shift Detail Report (Not Available via Direct API)

**What you mentioned:**
> "https://fabi.ipos.vn/report/revenue/revenue/shift-detail?store=...&shift_id=..."

**Status:** ⚠️ Available but requires shift_id (must scrape or derive)

**Would provide:**
- List of bills processed during shift
- Line items for each bill
- Payment methods
- Staff member who processed

---

## 🎯 Recommendation Priority

### **Tier 1: Easy Wins (API-based, 5-minute implementation)**
1. ✅ **Item Sales** - Track Entry Combo vs Entry Only tickets
2. ✅ **Payment Methods** - Cash vs Card breakdown
3. ✅ **Weekday Trends** - Identify busy days

### **Tier 2: Valuable but Complex (Requires Playwright scraping)**
4. ⚠️ **Table-level unpaid bills** - Real-time G1T01, G1T02 status
5. ⚠️ **Shift detail with line items** - Bill-level breakdown

---

## 📊 Sample Use Cases

### Use Case 1: Entry Ticket Dashboard
**Goal:** Show Entry Combo vs Entry Only sales for today

**Implementation:**
- Call `/api/v1/reports/sale-summary/items?limit=100`
- Filter for `item_type_name === "ENTRY" OR "ID_COMBOS"`
- Display: "Today: 229 Entry Combo, 35 Entry Only"

### Use Case 2: Payment Preference
**Goal:** Show cash vs card vs QR usage

**Implementation:**
- Call `/api/v1/reports/sale-summary/payment-methods`
- Display pie chart of payment methods

### Use Case 3: Top Sellers
**Goal:** Show top 10 items sold today

**Implementation:**
- Call `/api/v1/reports/sale-summary/items?limit=10&order_by=revenue_net`
- Display list with quantity and revenue

### Use Case 4: Unpaid Bills by Table (Complex)
**Goal:** Show which tables have unpaid bills and amounts

**Implementation:**
- Use Playwright to scrape `/sale-tracking` page
- Parse table IDs (G1T01, G1T02, etc.) and amounts
- Display: "G1T01: 245,000₫ | G1T02: 189,000₫"

---

## 📁 Files Created During Discovery

- `ipos-api-responses.json` - Full captured API responses
- `ipos-exploration-results.json` - Navigation logs (if exists)

---

## ✅ Next Steps (Awaiting Your Decision)

1. **Choose which endpoints to implement**
2. **Decide on UI placement** (new dashboard? existing page?)
3. **Prioritize Tier 1 vs Tier 2 features**
4. **Define refresh frequency** (current: 5 minutes)

Let me know which data you want to expose and I'll build the implementation!
