// scripts/test-ipos-login-approaches.js
// Test different approaches to authenticate with iPOS API

const EMAIL = process.env.IPOS_EMAIL || 'sipnplay@ipos.vn';
const PASSWORD = process.env.IPOS_PASSWORD || '123123A';

async function testApproach1_DirectAPILogin() {
  console.log('\n📝 Approach 1: Direct API Login (POST /api/v1/auth/login)\n');

  try {
    const response = await fetch('https://posapi.ipos.vn/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD
      })
    });

    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Response:', text);

    if (response.ok) {
      console.log('✅ Success!');
      try {
        const json = JSON.parse(text);
        console.log('Parsed:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('Response is not JSON');
      }
    } else {
      console.log('❌ Failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testApproach2_WebFormLogin() {
  console.log('\n📝 Approach 2: Web Form Login (POST /login)\n');

  try {
    // First, get the login page to see if there's any CSRF token
    const loginPageResponse = await fetch('https://fabi.ipos.vn/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    console.log('Login page status:', loginPageResponse.status);

    const setCookies = loginPageResponse.headers.get('set-cookie');
    console.log('Set-Cookie:', setCookies);

    const loginPageHtml = await loginPageResponse.text();

    // Look for CSRF token in the HTML
    const csrfMatch = loginPageHtml.match(/csrf[^"]*"[^"]*value="([^"]+)"/i) ||
                      loginPageHtml.match(/<input[^>]*name="csrf[^"]*"[^>]*value="([^"]+)"/i) ||
                      loginPageHtml.match(/<input[^>]*name="_token"[^>]*value="([^"]+)"/i);

    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    console.log('CSRF Token found:', csrfToken || 'None');

    // Now try to login with form data
    const formData = new URLSearchParams();
    formData.append('email', EMAIL);
    formData.append('password', PASSWORD);
    if (csrfToken) {
      formData.append('_token', csrfToken);
    }

    const response = await fetch('https://fabi.ipos.vn/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': setCookies || '',
        'Referer': 'https://fabi.ipos.vn/login'
      },
      body: formData.toString(),
      redirect: 'manual' // Don't follow redirects automatically
    });

    console.log('\nLogin POST response:');
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const responseCookies = response.headers.get('set-cookie');
    console.log('Response Cookies:', responseCookies);

    const location = response.headers.get('location');
    console.log('Redirect Location:', location);

    // If redirected, follow the redirect
    if (location && (response.status === 301 || response.status === 302)) {
      console.log('\n📍 Following redirect to:', location);

      const redirectResponse = await fetch(location.startsWith('http') ? location : `https://fabi.ipos.vn${location}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': responseCookies || ''
        }
      });

      console.log('Redirect status:', redirectResponse.status);
      const redirectCookies = redirectResponse.headers.get('set-cookie');
      console.log('Redirect cookies:', redirectCookies);

      const html = await redirectResponse.text();

      // Look for tokens in the HTML
      const tokenMatches = html.match(/access[_-]?token['"]?\s*[:=]\s*['"]?([a-f0-9]{32})/i);
      const authMatches = html.match(/authorization['"]?\s*[:=]\s*['"]?(eyJ[^'"]+)/i);

      if (tokenMatches) {
        console.log('\n✅ Found access_token in HTML:', tokenMatches[1]);
      }
      if (authMatches) {
        console.log('✅ Found authorization token in HTML:', authMatches[1].substring(0, 50) + '...');
      }

      if (!tokenMatches && !authMatches) {
        console.log('\n❌ No tokens found in redirect page');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testApproach3_SessionBasedAuth() {
  console.log('\n📝 Approach 3: Session-Based Authentication\n');

  try {
    // Try to get a session first
    const sessionResponse = await fetch('https://fabi.ipos.vn/', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    const sessionCookie = sessionResponse.headers.get('set-cookie');
    console.log('Session cookie:', sessionCookie);

    // Try various auth endpoints
    const endpoints = [
      'https://posapi.ipos.vn/api/v1/auth/token',
      'https://posapi.ipos.vn/api/v1/session',
      'https://posapi.ipos.vn/api/v1/auth/session',
      'https://fabi.ipos.vn/api/auth/login',
      'https://fabi.ipos.vn/auth/login'
    ];

    for (const endpoint of endpoints) {
      console.log(`\nTrying: ${endpoint}`);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Cookie': sessionCookie || ''
          },
          body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });

        console.log(`  Status: ${response.status}`);
        if (response.ok) {
          const text = await response.text();
          console.log(`  ✅ Response: ${text.substring(0, 200)}`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function runAllTests() {
  console.log('='.repeat(80));
  console.log('iPOS Login Authentication Investigation');
  console.log('='.repeat(80));

  await testApproach1_DirectAPILogin();
  await testApproach2_WebFormLogin();
  await testApproach3_SessionBasedAuth();

  console.log('\n' + '='.repeat(80));
  console.log('Investigation Complete!');
  console.log('='.repeat(80) + '\n');
}

runAllTests().catch(console.error);
