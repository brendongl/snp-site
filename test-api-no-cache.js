// Force clear the cache by setting the timestamp to 0
// This will make the service fetch fresh data

const fetch = require('node-fetch');

async function testDashboardAPI() {
  console.log('[Test] Calling dashboard API...');

  try {
    const response = await fetch('http://localhost:3001/api/pos/dashboard');
    const data = await response.json();

    console.log('\n=== API Response ===');
    console.log('Success:', data.success);
    console.log('Data:', JSON.stringify(data.data, null, 2));

    if (data.data) {
      console.log('\n=== Extracted Values ===');
      console.log('Unpaid Amount:', data.data.unpaidAmount);
      console.log('Paid Amount:', data.data.paidAmount);
      console.log('Current Tables:', data.data.currentTables);
      console.log('Current Customers:', data.data.currentCustomers);
    }
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

// Call the API multiple times to test caching
(async () => {
  console.log('=== First Call (Should fetch fresh) ===');
  await testDashboardAPI();

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n=== Second Call (Should use cache) ===');
  await testDashboardAPI();
})();