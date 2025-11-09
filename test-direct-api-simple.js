// test-direct-api-simple.js
// Test if the API works with just the hardcoded access_token

const HARDCODED_ACCESS_TOKEN = '5c885b2ef8c34fb7b1d1fad11eef7bec';

async function testAPIWithAccessTokenOnly() {
  console.log('Testing iPOS API with ONLY the hardcoded access_token...\n');

  // Get today's date range (10 AM to 9:59 AM next day)
  const now = new Date();
  const today = new Date(now);
  today.setHours(10, 0, 0, 0); // 10 AM today

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 59, 59, 999); // 9:59:59 AM tomorrow

  const startDate = today.getTime();
  const endDate = tomorrow.getTime();

  const url = new URL('https://posapi.ipos.vn/api/v1/reports/sale-summary/overview');
  url.searchParams.append('brand_uid', '32774afe-fd5c-4028-b837-f91837c0307c');
  url.searchParams.append('company_uid', '8a508e04-440f-4145-9429-22b7696c6193');
  url.searchParams.append('list_store_uid', '72a800a6-1719-4b4b-9065-31ab2e0c07e5');
  url.searchParams.append('start_date', startDate.toString());
  url.searchParams.append('end_date', endDate.toString());
  url.searchParams.append('store_open_at', '10');

  console.log('Request URL:', url.toString());
  console.log('\nHeaders being sent:');
  console.log('  access_token:', HARDCODED_ACCESS_TOKEN);
  console.log('  authorization: NOT SENT (testing without it)\n');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'access_token': HARDCODED_ACCESS_TOKEN,
        // NOT sending authorization header on purpose
        'fabi_type': 'pos-cms',
        'x-client-timezone': '25200000',
        'accept-language': 'vi',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'referer': 'https://fabi.ipos.vn/'
      }
    });

    console.log('Response Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ SUCCESS! API works with just access_token!');
      console.log('\nData received:');
      console.log('  Revenue (NET):', data.data?.revenue_net || 0);
      console.log('  Unpaid Amount:', data.data?.sale_tracking?.total_amount || 0);
      console.log('  Active Tables:', data.data?.sale_tracking?.table_count || 0);
      console.log('  Current Customers:', data.data?.sale_tracking?.people_count || 0);

      console.log('\n🎉 CONCLUSION: The authorization JWT is NOT required!');
      console.log('    We only need the hardcoded access_token!');
    } else {
      console.log('\n❌ Failed - authorization header might be required');
      const text = await response.text();
      console.log('Error response:', text);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIWithAccessTokenOnly().catch(console.error);