// scripts/investigate-ipos-login.js
// Comprehensive investigation of iPOS login flow
// This script will help us understand how authentication actually works

const puppeteer = require('puppeteer');

const EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const PASSWORD = process.env.IPOS_PASSWORD || '123123A';

async function investigateLoginFlow() {
  console.log('\n🔍 Starting iPOS Login Flow Investigation...\n');

  const browser = await puppeteer.launch({
    headless: false, // Keep visible to observe behavior
    devtools: true,  // Open DevTools automatically
  });

  const page = await browser.newPage();

  // Enable request interception to log all requests
  await page.setRequestInterception(true);

  const requestLog = [];
  const responseLog = [];

  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();

    // Log all requests
    requestLog.push({
      url,
      method,
      headers,
      postData: request.postData()
    });

    // Log API requests specifically
    if (url.includes('posapi') || url.includes('api')) {
      console.log(`\n📤 REQUEST: ${method} ${url}`);
      console.log('Headers:', JSON.stringify(headers, null, 2));
      if (request.postData()) {
        console.log('Body:', request.postData());
      }
    }

    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();

    responseLog.push({
      url,
      status,
      headers
    });

    // Log API responses specifically
    if (url.includes('posapi') || url.includes('api')) {
      console.log(`\n📥 RESPONSE: ${status} ${url}`);
      console.log('Headers:', JSON.stringify(headers, null, 2));

      try {
        const contentType = headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          const body = await response.text();
          console.log('Body:', body.substring(0, 500));
        }
      } catch (error) {
        console.log('Could not read response body');
      }
    }
  });

  try {
    console.log('Step 1: Navigate to login page...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle2' });

    console.log('\n🔍 Checking for tokens in page...');

    // Check localStorage
    const localStorage = await page.evaluate(() => {
      return Object.assign({}, window.localStorage);
    });
    console.log('localStorage:', localStorage);

    // Check sessionStorage
    const sessionStorage = await page.evaluate(() => {
      return Object.assign({}, window.sessionStorage);
    });
    console.log('sessionStorage:', sessionStorage);

    // Check cookies
    const cookies = await page.cookies();
    console.log('Cookies before login:', cookies);

    console.log('\nStep 2: Filling in login form...');
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="mail"]', { timeout: 10000 });

    // Try to find email and password fields
    await page.type('input[type="email"], input[name="email"], input[placeholder*="mail"]', EMAIL);
    await page.type('input[type="password"], input[name="password"]', PASSWORD);

    console.log('\nStep 3: Submitting form...');

    // Wait for navigation after clicking submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('button[type="submit"]')
    ]);

    console.log('\n✅ Login successful! Analyzing post-login state...\n');

    // Check localStorage after login
    const localStorageAfter = await page.evaluate(() => {
      return Object.assign({}, window.localStorage);
    });
    console.log('localStorage after login:', localStorageAfter);

    // Check sessionStorage after login
    const sessionStorageAfter = await page.evaluate(() => {
      return Object.assign({}, window.sessionStorage);
    });
    console.log('sessionStorage after login:', sessionStorageAfter);

    // Check cookies after login
    const cookiesAfter = await page.cookies();
    console.log('Cookies after login:', cookiesAfter);

    // Check for tokens in page context
    const pageTokens = await page.evaluate(() => {
      // Look for common token variable names
      return {
        access_token: window.access_token || window.accessToken || window.ACCESS_TOKEN,
        auth_token: window.auth_token || window.authToken || window.AUTH_TOKEN,
        token: window.token || window.TOKEN,
        // Check if tokens are in any global config object
        config: window.config,
        app: window.app,
        store: window.store,
        __INITIAL_STATE__: window.__INITIAL_STATE__
      };
    });
    console.log('Tokens/Config in page context:', JSON.stringify(pageTokens, null, 2));

    console.log('\nStep 4: Navigate to dashboard to trigger API calls...');
    await page.goto('https://fabi.ipos.vn/dashboard', { waitUntil: 'networkidle2' });

    // Wait a bit for API calls to complete
    await page.waitForTimeout(3000);

    console.log('\n📊 Summary of Investigation:\n');
    console.log('='.repeat(80));

    // Analyze requests for tokens
    const apiRequests = requestLog.filter(r => r.url.includes('posapi'));
    if (apiRequests.length > 0) {
      console.log('\n🎯 API Requests Found:');
      apiRequests.forEach(req => {
        console.log(`\n  ${req.method} ${req.url}`);
        if (req.headers['access_token']) {
          console.log(`  ✅ access_token: ${req.headers['access_token']}`);
        }
        if (req.headers['authorization']) {
          console.log(`  ✅ authorization: ${req.headers['authorization'].substring(0, 50)}...`);
        }
      });
    }

    // Check for cookies with tokens
    const tokenCookies = cookiesAfter.filter(c =>
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('access') ||
      c.name.toLowerCase().includes('auth')
    );
    if (tokenCookies.length > 0) {
      console.log('\n🍪 Cookies with potential tokens:');
      tokenCookies.forEach(c => {
        console.log(`  ${c.name}: ${c.value.substring(0, 50)}...`);
      });
    }

    // Check localStorage/sessionStorage for tokens
    const allStorage = { ...localStorageAfter, ...sessionStorageAfter };
    const tokenKeys = Object.keys(allStorage).filter(k =>
      k.toLowerCase().includes('token') ||
      k.toLowerCase().includes('access') ||
      k.toLowerCase().includes('auth')
    );
    if (tokenKeys.length > 0) {
      console.log('\n💾 Storage keys with potential tokens:');
      tokenKeys.forEach(k => {
        const value = allStorage[k];
        console.log(`  ${k}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : value}`);
      });
    }

    console.log('\n='.repeat(80));
    console.log('\n⏸️  Browser will stay open for 60 seconds for manual inspection...');
    console.log('Check the Network tab in DevTools for the actual token values!');

    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('\n❌ Error during investigation:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Investigation complete!\n');
  }
}

investigateLoginFlow().catch(console.error);
