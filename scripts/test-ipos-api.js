// Test script for iPOS Direct API with captured tokens
// Verifies that both access_token and authorization JWT are working

require('dotenv').config();

const IPOS_BASE_URL = 'https://posapi.ipos.vn';
const IPOS_BRAND_UID = '32774afe-fd5c-4028-b837-f91837c0307c';
const IPOS_COMPANY_UID = '8a508e04-440f-4145-9429-22b7696c6193';
const IPOS_STORE_UID = '72a800a6-1719-4b4b-9065-31ab2e0c07e5';
const STORE_OPEN_HOUR = 10;
const CLIENT_TIMEZONE = 25200000;

async function testIPOSAPI() {
  console.log('\n=== iPOS Direct API Test ===\n');

  // Check environment variables
  const accessToken = process.env.IPOS_ACCESS_TOKEN;
  const authToken = process.env.IPOS_AUTH_TOKEN;

  if (!accessToken) {
    console.error('❌ IPOS_ACCESS_TOKEN not found in environment');
    console.log('   Please add it to your .env file');
    process.exit(1);
  }

  if (!authToken) {
    console.error('❌ IPOS_AUTH_TOKEN not found in environment');
    console.log('   Please run: node scripts/get-ipos-access-token.js');
    process.exit(1);
  }

  console.log('✅ Found IPOS_ACCESS_TOKEN:', accessToken);
  console.log('✅ Found IPOS_AUTH_TOKEN:', authToken.substring(0, 60) + '...\n');

  // Calculate today's date range (10 AM today to 9:59 AM tomorrow)
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(STORE_OPEN_HOUR, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  endDate.setMilliseconds(endDate.getMilliseconds() - 1);

  console.log('📅 Date Range:');
  console.log('   Start:', startDate.toISOString());
  console.log('   End:', endDate.toISOString());
  console.log();

  // Build API URL
  const url = new URL(`${IPOS_BASE_URL}/api/v1/reports/sale-summary/overview`);
  url.searchParams.append('brand_uid', IPOS_BRAND_UID);
  url.searchParams.append('company_uid', IPOS_COMPANY_UID);
  url.searchParams.append('list_store_uid', IPOS_STORE_UID);
  url.searchParams.append('start_date', startDate.getTime().toString());
  url.searchParams.append('end_date', endDate.getTime().toString());
  url.searchParams.append('store_open_at', STORE_OPEN_HOUR.toString());

  console.log('🌐 API Request:');
  console.log('   URL:', url.toString());
  console.log();

  try {
    console.log('📡 Sending request...\n');

    const startTime = Date.now();
    const response = await fetch(url.toString(), {
      headers: {
        'access_token': accessToken,
        'authorization': authToken,
        'fabi_type': 'pos-cms',
        'x-client-timezone': CLIENT_TIMEZONE.toString(),
        'accept-language': 'vi',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'referer': 'https://fabi.ipos.vn/'
      }
    });
    const duration = Date.now() - startTime;

    console.log('⏱️  Response time:', duration + 'ms');
    console.log('📊 Status:', response.status, response.statusText);
    console.log();

    if (!response.ok) {
      console.error('❌ API request failed!');
      const text = await response.text();
      console.error('Response body:', text.substring(0, 500));

      if (response.status === 401) {
        console.error('\n🔑 Authentication failed - possible reasons:');
        console.error('   1. Authorization token has expired');
        console.error('   2. Tokens are invalid');
        console.error('\n💡 Solution:');
        console.error('   Run: node scripts/get-ipos-access-token.js');
        console.error('   Then update IPOS_AUTH_TOKEN in .env file');
      }

      process.exit(1);
    }

    const data = await response.json();

    console.log('✅ SUCCESS! API is working!\n');
    console.log('📈 Dashboard Data:');
    console.log('   Unpaid Amount:', formatVND(data.data.sale_tracking.total_amount), 'VND');
    console.log('   Today\'s Revenue (NET):', formatVND(data.data.revenue_net), 'VND');
    console.log('   Active Tables:', data.data.sale_tracking.table_count);
    console.log('   Current Customers:', data.data.sale_tracking.people_count);
    console.log();

    console.log('🎉 All tests passed!');
    console.log('💡 The Direct API integration is ready for production.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

testIPOSAPI().catch(console.error);
