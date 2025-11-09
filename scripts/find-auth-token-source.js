// scripts/find-auth-token-source.js
// Focused script to find where the authorization JWT token comes from

const puppeteer = require('puppeteer');
const fs = require('fs');

const EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const PASSWORD = process.env.IPOS_PASSWORD || '123123A';
const HARDCODED_ACCESS_TOKEN = '5c885b2ef8c34fb7b1d1fad11eef7bec';

async function findAuthTokenSource() {
  const findings = [];
  const log = (message) => {
    console.log(message);
    findings.push(message);
  };

  log('🔍 Finding authorization token source...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Capture all network activity
    const authTokens = new Set();
    const tokenSources = [];

    page.on('request', request => {
      const authHeader = request.headers()['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authTokens.add(authHeader);
        tokenSources.push({
          type: 'request',
          url: request.url(),
          token: authHeader.substring(0, 60) + '...',
          timestamp: new Date().toISOString()
        });
      }
    });

    page.on('response', async response => {
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('json')) {
          const text = await response.text();
          const json = JSON.parse(text);

          // Look for JWT tokens in various fields
          const checkField = (obj, path = []) => {
            if (typeof obj === 'string' && obj.startsWith('eyJ')) {
              tokenSources.push({
                type: 'response',
                url: response.url(),
                field: path.join('.'),
                token: obj.substring(0, 60) + '...',
                timestamp: new Date().toISOString()
              });
            } else if (typeof obj === 'object' && obj !== null) {
              for (const [key, value] of Object.entries(obj)) {
                checkField(value, [...path, key]);
              }
            }
          };

          checkField(json);
        }
      } catch (e) {
        // Not JSON or can't parse
      }
    });

    log('Step 1: Loading login page...');
    await page.goto('https://fabi.ipos.vn/login', { waitUntil: 'networkidle0' });

    // Wait longer for Vue.js app to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check storage before login
    const beforeStorage = await page.evaluate(() => ({
      localStorage: Object.keys(localStorage).reduce((acc, key) => {
        acc[key] = localStorage.getItem(key)?.substring(0, 100);
        return acc;
      }, {}),
      sessionStorage: Object.keys(sessionStorage).reduce((acc, key) => {
        acc[key] = sessionStorage.getItem(key)?.substring(0, 100);
        return acc;
      }, {})
    }));

    log('\nStep 2: Entering credentials...');
    // Use correct selectors based on inspection
    await page.waitForSelector('input[name="email_input"]', { timeout: 10000 });
    await page.type('input[name="email_input"]', EMAIL);

    // Password field has no name, use class selector
    await page.waitForSelector('input[type="password"].form-control', { timeout: 5000 });
    await page.type('input[type="password"].form-control', PASSWORD);

    log('\nStep 3: Clicking login...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginBtn = buttons.find(btn =>
        btn.textContent.includes('Đăng nhập') ||
        btn.textContent.includes('Login') ||
        btn.type === 'submit'
      );
      if (loginBtn) loginBtn.click();
    });

    // Wait for navigation or timeout
    try {
      await page.waitForNavigation({ timeout: 10000, waitUntil: 'networkidle0' });
      log('✅ Navigation completed');
    } catch (e) {
      log('⏳ Navigation timeout, checking current state...');
    }

    // Wait a bit more for async operations
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check storage after login
    const afterStorage = await page.evaluate(() => ({
      localStorage: Object.keys(localStorage).reduce((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {}),
      sessionStorage: Object.keys(sessionStorage).reduce((acc, key) => {
        acc[key] = sessionStorage.getItem(key);
        return acc;
      }, {})
    }));

    log('\n' + '='.repeat(80));
    log('FINDINGS');
    log('='.repeat(80));

    // Check localStorage for tokens
    log('\n📦 LocalStorage Analysis:');
    for (const [key, value] of Object.entries(afterStorage.localStorage)) {
      if (typeof value === 'string') {
        // Check if it's a JWT
        if (value.startsWith('eyJ')) {
          log(`  ✅ FOUND JWT in localStorage['${key}']`);
          log(`     Value: ${value.substring(0, 80)}...`);
          log(`     Length: ${value.length}`);
        }
        // Check if key suggests it's an auth token
        else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
          log(`  ⭐ FOUND token-related key: '${key}'`);
          log(`     Value: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
        }
      }
    }

    // Check sessionStorage for tokens
    log('\n📦 SessionStorage Analysis:');
    for (const [key, value] of Object.entries(afterStorage.sessionStorage)) {
      if (typeof value === 'string') {
        if (value.startsWith('eyJ')) {
          log(`  ✅ FOUND JWT in sessionStorage['${key}']`);
          log(`     Value: ${value.substring(0, 80)}...`);
          log(`     Length: ${value.length}`);
        }
        else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
          log(`  ⭐ FOUND token-related key: '${key}'`);
          log(`     Value: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
        }
      }
    }

    // Check cookies
    const cookies = await page.cookies();
    log('\n🍪 Cookies Analysis:');
    for (const cookie of cookies) {
      if (cookie.value.startsWith('eyJ')) {
        log(`  ✅ FOUND JWT in cookie: '${cookie.name}'`);
        log(`     Value: ${cookie.value.substring(0, 80)}...`);
      } else if (cookie.name.toLowerCase().includes('token') || cookie.name.toLowerCase().includes('auth')) {
        log(`  ⭐ FOUND token-related cookie: '${cookie.name}'`);
        log(`     Value: ${cookie.value.substring(0, 80)}${cookie.value.length > 80 ? '...' : ''}`);
      }
    }

    // Analyze token sources from network
    if (tokenSources.length > 0) {
      log('\n🌐 Token Sources from Network:');
      tokenSources.forEach((source, i) => {
        log(`\n  Source ${i + 1}:`);
        log(`    Type: ${source.type}`);
        log(`    URL: ${source.url}`);
        if (source.field) log(`    Field: ${source.field}`);
        log(`    Token: ${source.token}`);
        log(`    Time: ${source.timestamp}`);
      });
    } else {
      log('\n❌ No authorization tokens found in network traffic');
    }

    // Navigate to dashboard to trigger API calls
    log('\n\nStep 4: Navigating to dashboard to trigger API calls...');
    await page.goto('https://fabi.ipos.vn/dashboard', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for new token sources
    if (tokenSources.length > 0) {
      log(`\n✅ Total ${tokenSources.length} token sources found after dashboard visit`);

      // Show the first token source (most likely the auth source)
      const firstSource = tokenSources[0];
      log('\n🎯 First Token Appearance:');
      log(`   Type: ${firstSource.type}`);
      log(`   URL: ${firstSource.url}`);
      log(`   Token: ${firstSource.token}`);

      // Try to correlate with storage
      const tokenStart = firstSource.token.substring(0, 30);
      const foundInStorage = Object.entries(afterStorage.localStorage).find(([k, v]) =>
        typeof v === 'string' && v.includes(tokenStart)
      ) || Object.entries(afterStorage.sessionStorage).find(([k, v]) =>
        typeof v === 'string' && v.includes(tokenStart)
      );

      if (foundInStorage) {
        log(`   ✅ Token found in ${foundInStorage[0]}`);
      } else {
        log(`   ❓ Token source unknown - may be injected by JavaScript`);
      }
    }

    log('\n' + '='.repeat(80));
    log('RECOMMENDATIONS');
    log('='.repeat(80));

    if (tokenSources.length > 0) {
      log('\n✅ Authorization tokens are being used!');
      log('   Next steps:');
      log('   1. Identify where the first token came from (see above)');
      log('   2. Look for a login response that returns this token');
      log('   3. Replicate that request in the auth service');
    } else {
      log('\n❌ No authorization tokens detected');
      log('   Possible reasons:');
      log('   1. Login may have failed');
      log('   2. Tokens may be set via different mechanism');
      log('   3. Dashboard may not be making API calls');
    }

    // Write findings to file
    fs.writeFileSync(
      'ipos-auth-findings.log',
      findings.join('\n'),
      'utf8'
    );
    log('\n💾 Findings saved to ipos-auth-findings.log');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

findAuthTokenSource().catch(console.error);
