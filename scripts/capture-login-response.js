// scripts/capture-login-response.js
// Capture what the login endpoint returns

const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  console.log('\n=== iPOS Login Response Capture ===\n');

  const email = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
  const password = process.env.IPOS_PASSWORD || '123123A';

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept all responses
  page.on('response', async response => {
    const url = response.url();

    // Look for the login response
    if (url.includes('/api/accounts/v1/user/login')) {
      console.log('\n📡 LOGIN RESPONSE CAPTURED!');
      console.log('URL:', url);
      console.log('Status:', response.status());
      console.log('Headers:', response.headers());

      try {
        const body = await response.json();
        console.log('\nResponse Body:');
        console.log(JSON.stringify(body, null, 2));

        // Look for tokens in the response
        if (body.access_token) console.log('\n✅ Found access_token in response!');
        if (body.authorization) console.log('✅ Found authorization in response!');
        if (body.token) console.log('✅ Found token in response!');
        if (body.jwt) console.log('✅ Found jwt in response!');
        if (body.data?.access_token) console.log('✅ Found data.access_token in response!');
        if (body.data?.token) console.log('✅ Found data.token in response!');
      } catch (e) {
        console.log('Could not parse response as JSON');
      }
    }
  });

  console.log('Step 1: Navigating to login page...');
  await page.goto('https://fabi.ipos.vn/login');

  console.log('Step 2: Filling in credentials...');
  await page.fill('input[name="email_input"]', email);
  await page.fill('input[type="password"]', password);

  console.log('Step 3: Logging in and capturing response...');
  await page.click('button:has-text("Đăng nhập")');

  console.log('Step 4: Waiting for login to complete...');
  await page.waitForTimeout(5000);

  // Check localStorage and sessionStorage after login
  console.log('\n📦 Checking browser storage after login:\n');

  const localStorage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      items[key] = window.localStorage.getItem(key);
    }
    return items;
  });

  console.log('LocalStorage:');
  for (const [key, value] of Object.entries(localStorage)) {
    console.log(`  ${key}:`, value?.substring(0, 100) + (value?.length > 100 ? '...' : ''));
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
      console.log(`    ⭐ Possible auth data!`);
    }
  }

  const sessionStorage = await page.evaluate(() => {
    const items = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      items[key] = window.sessionStorage.getItem(key);
    }
    return items;
  });

  console.log('\nSessionStorage:');
  for (const [key, value] of Object.entries(sessionStorage)) {
    console.log(`  ${key}:`, value?.substring(0, 100) + (value?.length > 100 ? '...' : ''));
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
      console.log(`    ⭐ Possible auth data!`);
    }
  }

  // Check cookies
  const cookies = await context.cookies();
  console.log('\n🍪 Cookies:');
  for (const cookie of cookies) {
    console.log(`  ${cookie.name}:`, cookie.value.substring(0, 50) + (cookie.value.length > 50 ? '...' : ''));
    if (cookie.name.toLowerCase().includes('token') || cookie.name.toLowerCase().includes('auth')) {
      console.log(`    ⭐ Possible auth cookie!`);
    }
  }

  console.log('\n===============================');
  console.log('Keep browser open to inspect...');
  console.log('Press Ctrl+C to exit');

  // Keep browser open
  await new Promise(() => {});
})();