// Investigation: Can we use cookies + session state to make API calls without browser?
// This tests if capturing ALL browser state (cookies, localStorage, headers) allows API access

const { chromium } = require('playwright');
require('dotenv').config();

async function investigateFullSessionState() {
  console.log('\n' + '='.repeat(60));
  console.log('Investigating: Cookies + Session State for API Access');
  console.log('='.repeat(60) + '\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('Step 1: Logging in...');
    await page.goto('https://fabi.ipos.vn/login');
    await page.fill('input[name="email_input"]', process.env.IPOS_EMAIL);
    await page.fill('input[type="password"]', process.env.IPOS_PASSWORD);
    await Promise.all([
      page.waitForNavigation(),
      page.click('button:has-text("Đăng nhập")')
    ]);

    console.log('Step 2: Waiting for dashboard...');
    await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Extract ALL possible session state
    console.log('\nStep 3: Extracting complete session state...\n');

    // Get cookies
    const cookies = await context.cookies();
    console.log('📦 Cookies found:', cookies.length);
    cookies.forEach(cookie => {
      console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });

    // Get localStorage
    const localStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        items[key] = window.localStorage.getItem(key);
      }
      return items;
    });
    console.log('\n💾 LocalStorage items:', Object.keys(localStorage).length);
    Object.entries(localStorage).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value.substring(0, 50)}...`);
    });

    // Get sessionStorage
    const sessionStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        items[key] = window.sessionStorage.getItem(key);
      }
      return items;
    });
    console.log('\n🗄️  SessionStorage items:', Object.keys(sessionStorage).length);
    Object.entries(sessionStorage).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value.substring(0, 50)}...`);
    });

    // Capture an actual API request to see what headers it uses
    console.log('\n📡 Capturing actual API request headers...\n');

    let capturedRequest = null;
    page.on('request', request => {
      if (request.url().includes('sale-summary/overview')) {
        capturedRequest = {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        };
      }
    });

    await page.reload();
    await page.waitForTimeout(5000);

    if (capturedRequest) {
      console.log('✅ Captured API Request:');
      console.log('   URL:', capturedRequest.url);
      console.log('   Method:', capturedRequest.method);
      console.log('   Headers:');
      Object.entries(capturedRequest.headers).forEach(([key, value]) => {
        console.log(`      ${key}: ${value}`);
      });
    }

    // Now test if we can use this state in Node.js fetch
    console.log('\n' + '='.repeat(60));
    console.log('Testing: Can we use this state in Node.js fetch?');
    console.log('='.repeat(60) + '\n');

    if (capturedRequest && localStorage.token) {
      const testUrl = 'https://posapi.ipos.vn/api/v1/reports/sale-summary/overview?brand_uid=32774afe-fd5c-4028-b837-f91837c0307c&company_uid=8a508e04-440f-4145-9429-22b7696c6193&list_store_uid=72a800a6-1719-4b4b-9065-31ab2e0c07e5&start_date=1762621200000&end_date=1762707599999&store_open_at=10';

      // Build cookie header from cookies array
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      console.log('Attempting fetch with captured state...');

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'access_token': capturedRequest.headers['access_token'],
          'authorization': `Bearer ${localStorage.token}`,
          'cookie': cookieHeader,
          'fabi_type': 'pos-cms',
          'x-client-timezone': '25200000',
          'accept-language': 'vi',
          'referer': 'https://fabi.ipos.vn/',
          'user-agent': capturedRequest.headers['user-agent'],
          'accept': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (response.status === 200) {
        const data = await response.json();
        console.log('✅ SUCCESS! Fetch worked with captured state!');
        console.log('Data preview:', JSON.stringify(data, null, 2).substring(0, 200));

        console.log('\n🎉 SOLUTION FOUND!');
        console.log('We can use: access_token + Bearer token + cookies');
        console.log('\n💡 This means we can:');
        console.log('   1. Login once with Playwright locally');
        console.log('   2. Capture all session state');
        console.log('   3. Save to database/file');
        console.log('   4. Railway uses that state for API calls');
        console.log('   5. Refresh periodically when it expires');
      } else {
        const text = await response.text();
        console.log('❌ Failed:', text.substring(0, 200));
        console.log('\nThis approach does not work - tokens are still session-bound');
      }
    }

    console.log('\nBrowser will stay open for 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

investigateFullSessionState().catch(console.error);
