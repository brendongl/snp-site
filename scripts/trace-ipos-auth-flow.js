// scripts/trace-ipos-auth-flow.js
// Deep investigation of iPOS authentication flow
// Captures all network activity, localStorage, sessionStorage, and cookies during login

const puppeteer = require('puppeteer');

const EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const PASSWORD = process.env.IPOS_PASSWORD || '123123A';

// Known hardcoded access_token from frontend
const HARDCODED_ACCESS_TOKEN = '5c885b2ef8c34fb7b1d1fad11eef7bec';

async function traceAuthFlow() {
  console.log('🔍 Starting comprehensive iPOS authentication flow trace...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for visibility
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Store all network requests
    const networkLog = [];

    // Intercept all requests
    await page.setRequestInterception(true);

    page.on('request', request => {
      const entry = {
        type: 'request',
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        headers: request.headers(),
        postData: request.postData()
      };

      // Log interesting requests
      if (request.url().includes('ipos.vn') || request.url().includes('login') || request.url().includes('auth')) {
        console.log(`\n📤 REQUEST: ${request.method()} ${request.url()}`);
        if (request.postData()) {
          console.log(`   Body: ${request.postData().substring(0, 200)}`);
        }
        // Check for tokens in headers
        if (request.headers()['access_token']) {
          console.log(`   ✅ access_token header: ${request.headers()['access_token']}`);
        }
        if (request.headers()['authorization']) {
          console.log(`   ✅ authorization header: ${request.headers()['authorization'].substring(0, 50)}...`);
        }
      }

      networkLog.push(entry);
      request.continue();
    });

    // Intercept all responses
    page.on('response', async response => {
      const entry = {
        type: 'response',
        timestamp: new Date().toISOString(),
        status: response.status(),
        url: response.url(),
        headers: response.headers()
      };

      // Log interesting responses
      if (response.url().includes('ipos.vn') || response.url().includes('login') || response.url().includes('auth')) {
        console.log(`\n📥 RESPONSE: ${response.status()} ${response.url()}`);

        // Check Set-Cookie headers
        const setCookie = response.headers()['set-cookie'];
        if (setCookie) {
          console.log(`   🍪 Set-Cookie: ${setCookie}`);
        }

        // Try to get response body
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const text = await response.text();
            entry.body = text;

            // Parse and look for tokens
            try {
              const json = JSON.parse(text);
              console.log(`   📄 JSON Response:`);

              // Look for various token fields
              if (json.access_token) console.log(`   ✅ Found access_token: ${json.access_token}`);
              if (json.authorization) console.log(`   ✅ Found authorization: ${json.authorization.substring(0, 50)}...`);
              if (json.token) console.log(`   ✅ Found token: ${json.token.substring(0, 50)}...`);
              if (json.jwt) console.log(`   ✅ Found jwt: ${json.jwt.substring(0, 50)}...`);
              if (json.data?.access_token) console.log(`   ✅ Found data.access_token: ${json.data.access_token}`);
              if (json.data?.token) console.log(`   ✅ Found data.token: ${json.data.token.substring(0, 50)}...`);

              // Show full structure for auth-related responses
              if (response.url().includes('auth') || response.url().includes('login')) {
                console.log(`   Full response: ${JSON.stringify(json, null, 2).substring(0, 500)}`);
              }
            } catch (e) {
              // Not valid JSON
            }
          }
        } catch (e) {
          // Can't read body
        }
      }

      networkLog.push(entry);
    });

    console.log('📋 Step 1: Loading login page...\n');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle2' });

    // Check storage BEFORE login
    console.log('\n🔍 Checking storage BEFORE login:\n');
    const beforeStorage = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      };
    });
    console.log('LocalStorage:', JSON.stringify(beforeStorage.localStorage, null, 2));
    console.log('SessionStorage:', JSON.stringify(beforeStorage.sessionStorage, null, 2));

    // Get cookies before login
    const beforeCookies = await page.cookies();
    console.log('\n🍪 Cookies BEFORE login:');
    beforeCookies.forEach(cookie => {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 50)}${cookie.value.length > 50 ? '...' : ''}`);
    });

    console.log('\n📋 Step 2: Entering credentials and logging in...\n');

    // Enter email
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    await page.type('input[type="email"], input[name="email"]', EMAIL);

    // Enter password
    await page.type('input[type="password"], input[name="password"]', PASSWORD);

    // Click login button
    const loginButton = await page.$('button[type="submit"], button:contains("Đăng nhập")');
    if (loginButton) {
      await loginButton.click();
    } else {
      // Try finding by text
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginBtn = buttons.find(btn => btn.textContent.includes('Đăng nhập') || btn.textContent.includes('Login'));
        if (loginBtn) loginBtn.click();
      });
    }

    console.log('\n⏳ Waiting for navigation after login...\n');

    // Wait for navigation or dashboard to load
    try {
      await page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle2' });
    } catch (e) {
      console.log('   Navigation timeout, checking current state...');
    }

    // Wait a bit for any async token fetching
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🔍 Checking storage AFTER login:\n');
    const afterStorage = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      };
    });

    console.log('LocalStorage:');
    for (const [key, value] of Object.entries(afterStorage.localStorage)) {
      console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) : value}${value.length > 100 ? '...' : ''}`);

      // Highlight token-like values
      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
        console.log(`  ⭐ POTENTIAL TOKEN: ${key}`);
      }
    }

    console.log('\nSessionStorage:');
    for (const [key, value] of Object.entries(afterStorage.sessionStorage)) {
      console.log(`  ${key}: ${typeof value === 'string' ? value.substring(0, 100) : value}${value.length > 100 ? '...' : ''}`);

      if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
        console.log(`  ⭐ POTENTIAL TOKEN: ${key}`);
      }
    }

    // Get cookies after login
    const afterCookies = await page.cookies();
    console.log('\n🍪 Cookies AFTER login:');
    afterCookies.forEach(cookie => {
      console.log(`  ${cookie.name}: ${cookie.value.substring(0, 50)}${cookie.value.length > 50 ? '...' : ''}`);

      if (cookie.name.toLowerCase().includes('token') || cookie.name.toLowerCase().includes('auth')) {
        console.log(`  ⭐ POTENTIAL TOKEN COOKIE: ${cookie.name}`);
      }
    });

    // Check current URL
    const currentUrl = page.url();
    console.log(`\n🌐 Current URL: ${currentUrl}`);

    // Look for tokens in page source
    console.log('\n🔍 Searching page source for tokens...\n');
    const pageContent = await page.content();

    // Search for access_token
    const accessTokenMatches = pageContent.match(/access[_-]?token['\"]?\s*[:=]\s*['\"]?([a-f0-9]{32})/gi);
    if (accessTokenMatches) {
      console.log('✅ Found access_token patterns in page source:');
      accessTokenMatches.forEach(match => console.log(`   ${match}`));
    }

    // Search for JWT-like tokens
    const jwtMatches = pageContent.match(/['\"]?(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)['\"]?/g);
    if (jwtMatches) {
      console.log('\n✅ Found JWT-like tokens in page source:');
      jwtMatches.slice(0, 5).forEach(match => console.log(`   ${match.substring(0, 80)}...`));
    }

    // Check for API calls to posapi.ipos.vn
    console.log('\n🔍 Looking for API calls to posapi.ipos.vn...\n');
    const apiCalls = networkLog.filter(entry =>
      entry.url && entry.url.includes('posapi.ipos.vn')
    );

    if (apiCalls.length > 0) {
      console.log(`✅ Found ${apiCalls.length} API calls to posapi.ipos.vn`);

      // Show the first few API calls with headers
      apiCalls.slice(0, 3).forEach((call, index) => {
        console.log(`\n   Call ${index + 1}:`);
        console.log(`   URL: ${call.url}`);
        if (call.type === 'request' && call.headers) {
          if (call.headers['access_token']) {
            console.log(`   ✅ access_token: ${call.headers['access_token']}`);
          }
          if (call.headers['authorization']) {
            console.log(`   ✅ authorization: ${call.headers['authorization'].substring(0, 50)}...`);
          }
        }
      });
    } else {
      console.log('❌ No API calls to posapi.ipos.vn found');
    }

    // Try to trigger an API call by navigating to dashboard
    console.log('\n📋 Step 3: Navigating to dashboard to trigger API calls...\n');
    try {
      await page.goto('https://fabi.ipos.vn/dashboard', { waitUntil: 'networkidle2', timeout: 10000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for new API calls
      const newApiCalls = networkLog.filter(entry =>
        entry.url && entry.url.includes('posapi.ipos.vn') && entry.type === 'request'
      );

      if (newApiCalls.length > apiCalls.length) {
        console.log(`\n✅ Dashboard triggered ${newApiCalls.length - apiCalls.length} new API calls!`);

        // Show the most recent API call with tokens
        const latestCall = newApiCalls[newApiCalls.length - 1];
        console.log('\nMost recent API call:');
        console.log(`URL: ${latestCall.url}`);
        if (latestCall.headers['access_token']) {
          console.log(`✅ access_token: ${latestCall.headers['access_token']}`);
        }
        if (latestCall.headers['authorization']) {
          console.log(`✅ authorization: ${latestCall.headers['authorization']}`);
        }
      }
    } catch (e) {
      console.log('   Dashboard navigation error:', e.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY OF FINDINGS');
    console.log('='.repeat(80));

    // Analyze where tokens came from
    console.log('\n🔍 Token Analysis:');

    // Check if hardcoded token is being used
    const usesHardcodedToken = networkLog.some(entry =>
      entry.type === 'request' &&
      entry.headers?.access_token === HARDCODED_ACCESS_TOKEN
    );

    if (usesHardcodedToken) {
      console.log(`✅ Confirmed: Hardcoded access_token (${HARDCODED_ACCESS_TOKEN}) is being used`);
    }

    // Find authorization tokens
    const authTokens = new Set();
    networkLog.forEach(entry => {
      if (entry.type === 'request' && entry.headers?.authorization) {
        authTokens.add(entry.headers.authorization);
      }
    });

    if (authTokens.size > 0) {
      console.log(`\n✅ Found ${authTokens.size} unique authorization token(s):`);
      Array.from(authTokens).forEach((token, i) => {
        console.log(`   ${i + 1}. ${token.substring(0, 60)}...`);
      });

      // Try to trace where authorization token came from
      console.log('\n🔍 Tracing authorization token origin:');

      // Check localStorage
      const authInLocalStorage = Object.entries(afterStorage.localStorage).find(([key, value]) =>
        authTokens.has(value) || (typeof value === 'string' && value.includes(Array.from(authTokens)[0].substring(0, 20)))
      );

      if (authInLocalStorage) {
        console.log(`   ✅ Found in localStorage: ${authInLocalStorage[0]}`);
      }

      // Check sessionStorage
      const authInSessionStorage = Object.entries(afterStorage.sessionStorage).find(([key, value]) =>
        authTokens.has(value) || (typeof value === 'string' && value.includes(Array.from(authTokens)[0].substring(0, 20)))
      );

      if (authInSessionStorage) {
        console.log(`   ✅ Found in sessionStorage: ${authInSessionStorage[0]}`);
      }

      // Check cookies
      const authInCookie = afterCookies.find(cookie =>
        authTokens.has(cookie.value) || Array.from(authTokens)[0].includes(cookie.value)
      );

      if (authInCookie) {
        console.log(`   ✅ Found in cookie: ${authInCookie.name}`);
      }

      // Check if it came from a response
      const authFromResponse = networkLog.find(entry =>
        entry.type === 'response' &&
        entry.body &&
        (entry.body.includes(Array.from(authTokens)[0].substring(10, 30)))
      );

      if (authFromResponse) {
        console.log(`   ✅ Found in response from: ${authFromResponse.url}`);
      }

      if (!authInLocalStorage && !authInSessionStorage && !authInCookie && !authFromResponse) {
        console.log('   ❓ Could not determine origin - may be injected via JavaScript');
      }
    } else {
      console.log('\n❌ No authorization tokens found in any requests');
    }

    console.log('\n💡 Recommended Next Steps:');
    console.log('   1. Check the browser console for where authorization is set');
    console.log('   2. Inspect the JavaScript that runs after login');
    console.log('   3. Look for token injection in the page source');
    console.log('   4. Consider keeping browser open to manually inspect...');

    // Keep browser open for 30 seconds for manual inspection
    console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
    console.log('   Press Ctrl+C to close early\n');

    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('\n❌ Error during investigation:', error);
  } finally {
    await browser.close();
  }
}

traceAuthFlow().catch(console.error);
