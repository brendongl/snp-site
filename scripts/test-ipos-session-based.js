// Test script for session-based iPOS API access
// This proves the concept works before deploying to production

const { chromium } = require('playwright');
require('dotenv').config();

const IPOS_EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const IPOS_PASSWORD = process.env.IPOS_PASSWORD;

if (!IPOS_PASSWORD) {
  console.error('ERROR: IPOS_PASSWORD not set in .env file');
  process.exit(1);
}

async function testSessionBasedAPI() {
  console.log('\n' + '='.repeat(60));
  console.log('iPOS Session-Based API Access Test');
  console.log('='.repeat(60) + '\n');

  let capturedData = null;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set up response listener BEFORE navigating
  page.on('response', async (response) => {
    if (response.url().includes('sale-summary/overview')) {
      console.log(`\n🎯 CAPTURED API CALL: ${response.url()}`);
      console.log(`   Status: ${response.status()}`);

      if (response.status() === 200) {
        try {
          const data = await response.json();
          capturedData = data;
          console.log('   ✅ Successfully captured API response!');
          console.log(`   Data preview: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
        } catch (error) {
          console.error('   ⚠️  Error parsing JSON:', error.message);
        }
      } else {
        const text = await response.text();
        console.error(`   ❌ Non-200 response: ${text.substring(0, 200)}`);
      }
    }
  });

  try {
    console.log('Step 1: Navigating to login page...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle' });

    console.log('Step 2: Filling in credentials...');
    await page.fill('input[name="email_input"]', IPOS_EMAIL);
    await page.fill('input[type="password"]', IPOS_PASSWORD);

    console.log('Step 3: Logging in...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button:has-text("Đăng nhập")')
    ]);

    console.log('Step 4: Waiting for dashboard to load...');
    try {
      await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });
      console.log('   ✓ Dashboard loaded successfully');
    } catch (e) {
      console.log('   ⚠ Dashboard selector not found, continuing anyway...');
    }

    console.log('Step 5: Waiting for API calls to complete...');
    console.log('   Waiting 5 seconds for API calls...');
    await page.waitForTimeout(5000);

    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));

    if (capturedData) {
      console.log('\n✅ SUCCESS! API data captured from browser session!\n');

      // Extract the important fields
      const data = capturedData.data || {};
      const saleTracking = data.sale_tracking || {};

      console.log('📊 Dashboard Data:');
      console.log(`   Unpaid Amount: ${formatVND(saleTracking.total_amount || 0)} VND`);
      console.log(`   Today's Revenue (NET): ${formatVND(data.revenue_net || 0)} VND`);
      console.log(`   Active Tables: ${saleTracking.table_count || 0}`);
      console.log(`   Current Customers: ${saleTracking.people_count || 0}`);

      console.log('\n🎉 PROOF OF CONCEPT SUCCESSFUL!');
      console.log('\n💡 Key Findings:');
      console.log('   1. We CAN access the API by maintaining browser session');
      console.log('   2. No need to manually capture and manage tokens');
      console.log('   3. This approach will work on Railway in production');

      console.log('\n📋 Next Steps:');
      console.log('   1. Use ipos-session-service.ts in production');
      console.log('   2. Update /api/pos/dashboard to use session service');
      console.log('   3. Deploy to Railway staging for testing');
      console.log('   4. Monitor for session stability');

      // Test immediate re-use of session
      console.log('\n' + '='.repeat(60));
      console.log('TESTING IMMEDIATE SESSION RE-USE');
      console.log('='.repeat(60));

      console.log('\nNow testing if we can make another API call in the same session...');
      console.log('Reloading page to trigger another API call...');

      let secondCapturedData = null;
      const secondDataPromise = new Promise((resolve) => {
        const handler = async (response) => {
          if (response.url().includes('sale-summary/overview')) {
            if (response.status() === 200) {
              try {
                const data = await response.json();
                secondCapturedData = data;
                page.off('response', handler);
                resolve(data);
              } catch (e) {
                console.error('Error parsing second response:', e.message);
              }
            }
          }
        };
        page.on('response', handler);
      });

      await page.reload({ waitUntil: 'networkidle' });
      await Promise.race([
        secondDataPromise,
        new Promise((resolve) => setTimeout(resolve, 10000))
      ]);

      if (secondCapturedData) {
        console.log('\n✅ SUCCESS! Second API call also works in same session!');
        console.log('   This proves session persistence works.\n');
      } else {
        console.log('\n⚠️  Second API call not captured (may need longer wait)\n');
      }

    } else {
      console.log('\n❌ FAILED: No API data captured');
      console.log('\nPossible reasons:');
      console.log('   1. Dashboard didn\'t load the API call');
      console.log('   2. API call was made but response wasn\'t captured');
      console.log('   3. Network timing issue');

      console.log('\n💡 Debugging tips:');
      console.log('   1. Browser is staying open - check network tab');
      console.log('   2. Look for sale-summary/overview requests');
      console.log('   3. Check if any errors in console');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Keep browser open for manual inspection
    if (!capturedData) {
      console.log('Browser will stay open for 30 seconds for debugging...');
      await page.waitForTimeout(30000);
    } else {
      console.log('Keeping browser open for 10 seconds...');
      await page.waitForTimeout(10000);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
  } finally {
    await browser.close();
  }
}

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount);
}

testSessionBasedAPI().catch(console.error);
