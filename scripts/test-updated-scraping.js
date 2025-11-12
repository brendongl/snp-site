// scripts/test-updated-scraping.js
// Test the updated scraping logic

const { fetchIPOSDashboardData, getIPOSCredentials } = require('../lib/services/ipos-playwright-service.ts');

async function testUpdatedScraping() {
  console.log('🧪 Testing updated scraping logic...\n');

  const credentials = getIPOSCredentials();
  if (!credentials) {
    console.error('❌ IPOS credentials not configured');
    process.exit(1);
  }

  try {
    const data = await fetchIPOSDashboardData(credentials);

    console.log('\n✅ Successfully fetched data:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 Unpaid Amount:', data.unpaidAmount.toLocaleString(), '₫');
    console.log('✅ Paid Amount:', data.paidAmount.toLocaleString(), '₫');
    console.log('🪑 Current Tables:', data.currentTables);
    console.log('');
    console.log('👥 CUSTOMER COUNTS:');
    console.log('   ✅ Paid Customers:', data.paidCustomers, '(already left)');
    console.log('   ⏱️  Unpaid Customers:', data.unpaidCustomers, '(currently in store)');
    console.log('');
    console.log('⏰ Last Updated:', data.lastUpdated);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (data.unpaidCustomers > 0) {
      console.log('✅ SUCCESS! Found', data.unpaidCustomers, 'unpaid customers');
    } else {
      console.log('⚠️  WARNING: No unpaid customers found (expected at least 1)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testUpdatedScraping();
