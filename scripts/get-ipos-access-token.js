// Script to get the iPOS access token from the dashboard
// This captures the access_token used for API calls to posapi.ipos.vn

const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  console.log('\n=== iPOS Access Token Capture Tool ===\n');

  const email = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
  const password = process.env.IPOS_PASSWORD;

  if (!password) {
    console.error('ERROR: IPOS_PASSWORD not set in .env file');
    console.log('Please set your iPOS password in the .env file');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  await client.send('Network.enable');

  let capturedAccessToken = null;
  let capturedAuthToken = null;
  let apiCalls = [];

  // Capture all API calls to posapi.ipos.vn
  client.on('Network.requestWillBeSent', (params) => {
    if (params.request.url.includes('posapi.ipos.vn')) {
      const url = new URL(params.request.url);
      apiCalls.push({
        path: url.pathname,
        method: params.request.method,
        hasAccessToken: !!params.request.headers.access_token,
        hasAuthToken: !!params.request.headers.authorization
      });

      // Capture access token (hex)
      if (params.request.headers.access_token && !capturedAccessToken) {
        capturedAccessToken = params.request.headers.access_token;
        console.log('\n✅ ACCESS TOKEN CAPTURED!');
        console.log('Access Token (hex):', capturedAccessToken);
        console.log('Length:', capturedAccessToken.length, 'characters');
        console.log('Format:', /^[a-f0-9]{32}$/.test(capturedAccessToken) ? 'Valid hex (32 chars)' : 'Invalid format');
      }

      // Capture authorization token (JWT)
      if (params.request.headers.authorization && !capturedAuthToken) {
        capturedAuthToken = params.request.headers.authorization;
        console.log('\n✅ AUTH TOKEN CAPTURED!');
        console.log('Auth Token (JWT):', capturedAuthToken.substring(0, 50) + '...');
      }
    }
  });

  console.log('Step 1: Navigating to login page...');
  await page.goto('https://fabi.ipos.vn/login');

  console.log('Step 2: Filling in credentials...');
  await page.fill('input[name="email_input"]', email);
  await page.fill('input[type="password"]', password);

  console.log('Step 3: Logging in...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button:has-text("Đăng nhập")')
  ]);

  console.log('Step 4: Waiting for dashboard to load...');
  await page.waitForSelector('text=Doanh thu (NET)', { timeout: 15000 });

  console.log('Step 5: Waiting for API calls to complete...');
  await page.waitForTimeout(5000);

  console.log('\n=== RESULTS ===\n');

  if (capturedAccessToken && capturedAuthToken) {
    console.log('✅ SUCCESS! Both tokens captured:\n');
    console.log('# Add these to your .env file:');
    console.log('IPOS_ACCESS_TOKEN=' + capturedAccessToken);
    console.log('IPOS_AUTH_TOKEN=' + capturedAuthToken);
    console.log('\n✅ Direct API integration is now ready!');

    console.log('\n📊 API Calls Observed:');
    apiCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.method} ${call.path} [Access: ${call.hasAccessToken ? '✓' : '✗'}, Auth: ${call.hasAuthToken ? '✓' : '✗'}]`);
    });
  } else if (capturedAccessToken || capturedAuthToken) {
    console.log('⚠️  PARTIAL SUCCESS: Only one token captured');
    if (capturedAccessToken) {
      console.log('Access Token (hex):', capturedAccessToken);
    }
    if (capturedAuthToken) {
      console.log('Auth Token (JWT):', capturedAuthToken.substring(0, 50) + '...');
    }
    console.log('\nBoth tokens are required for the API to work.');
  } else {
    console.log('❌ FAILED: No tokens were captured.');
    console.log('\nPossible reasons:');
    console.log('  1. The dashboard might be using server-side rendering');
    console.log('  2. The API calls might be made from a different domain');
    console.log('  3. Authentication might have failed');

    if (apiCalls.length > 0) {
      console.log('\n📊 API Calls Observed (without token):');
      apiCalls.forEach((call, i) => {
        console.log(`  ${i + 1}. ${call.method} ${call.path}`);
      });
    } else {
      console.log('\nNo API calls to posapi.ipos.vn were observed.');
    }
  }

  console.log('\n===============================\n');
  console.log('Press Ctrl+C to close the browser and exit.');
})();