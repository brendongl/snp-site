// scripts/test-customer-count.js
// Quick test to verify the new customer counting system works

const { fetchIPOSDashboardData, getIPOSCredentials } = require('../lib/services/ipos-playwright-service.ts');

async function testCustomerCount() {
  console.log('🧪 Testing new customer counting system...\n');

  const credentials = getIPOSCredentials();
  if (!credentials) {
    console.error('❌ IPOS credentials not configured');
    process.exit(1);
  }

  try {
    const data = await fetchIPOSDashboardData(credentials);

    console.log('✅ Successfully fetched data:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💰 Revenue & Bills');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Unpaid Amount: ${data.unpaidAmount.toLocaleString()}₫`);
    console.log(`   Paid Amount: ${data.paidAmount.toLocaleString()}₫`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 Customer Counts (NEW!)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   ✅ Paid Customers: ${data.paidCustomers} (already left)`);
    console.log(`   ⏱️  Unpaid Customers: ${data.unpaidCustomers} (currently in store)`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🪑 Tables');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Active Tables: ${data.currentTables}`);
    console.log('');
    console.log(`⏰ Last Updated: ${data.lastUpdated}`);
    console.log('');

    // Verify the data structure
    if (typeof data.paidCustomers === 'number' && typeof data.unpaidCustomers === 'number') {
      console.log('✅ Data structure is correct!');
      console.log('✅ Ready for frontend integration');
    } else {
      console.log('❌ Data structure issue detected');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testCustomerCount();
