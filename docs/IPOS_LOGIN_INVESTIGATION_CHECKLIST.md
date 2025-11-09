# iPOS Login Flow Investigation Checklist

**Goal:** Understand how iPOS authentication works so we can implement automatic login

## What We Need to Find

1. **Initial authentication endpoint** - Where does the login form actually POST to?
2. **Token generation** - Where do the `access_token` and `authorization` tokens come from?
3. **Token storage** - Are tokens in cookies, localStorage, sessionStorage, or headers?
4. **Token format** - How are tokens generated/encoded?

## Investigation Steps

### Step 1: Open DevTools Before Login

1. Open Chrome
2. Press F12 to open DevTools
3. Go to **Network** tab
4. Check **"Preserve log"** checkbox (IMPORTANT!)
5. Check **"Disable cache"** checkbox
6. Clear existing log (trash icon)

### Step 2: Navigate to Login Page

1. Go to: https://fabi.ipos.vn/login
2. **DO NOT LOGIN YET**
3. In **Network** tab, look for any requests that set cookies or return tokens

### Step 3: Check Application State Before Login

Switch to **Application** tab:
- **Local Storage** → https://fabi.ipos.vn → (note any existing data)
- **Session Storage** → https://fabi.ipos.vn → (note any existing data)
- **Cookies** → https://fabi.ipos.vn → (note any existing cookies)

### Step 4: Perform Login

1. Return to **Network** tab
2. Enter credentials: sipnplay@ipos.vn / 123123A
3. Click login button
4. **WATCH THE NETWORK TAB CAREFULLY**

### Step 5: Analyze Login Request

In Network tab, find the login request (look for POST request):
- **Request URL** - What URL was called?
- **Request Method** - POST, GET, etc.?
- **Request Headers** - What headers were sent?
- **Request Payload** - What data was sent (email, password, other fields)?
- **Response Status** - 200 OK, 302 Redirect, etc.?
- **Response Headers** - Any Set-Cookie headers?
- **Response Body** - Any tokens in the response?

### Step 6: Check Application State After Login

Switch to **Application** tab again:
- **Local Storage** → Look for tokens (access_token, authorization, auth, token, etc.)
- **Session Storage** → Look for tokens
- **Cookies** → Look for new cookies with tokens

### Step 7: Find First API Call with Tokens

In **Network** tab:
1. Filter by: `posapi.ipos.vn`
2. Find the FIRST request to posapi.ipos.vn
3. Click on it
4. Check **Headers** tab:
   - Look for `access_token` header
   - Look for `authorization` header
   - Copy these values!

### Step 8: Trace Token Origin

For each token found (access_token, authorization):
1. Was it in the login response?
2. Was it set via JavaScript in the page?
3. Was it in a cookie?
4. Was it in localStorage/sessionStorage?

### Step 9: Check Dashboard Page Source

1. Navigate to: https://fabi.ipos.vn/dashboard
2. Right-click → "View Page Source"
3. Search for:
   - `access_token`
   - `authorization`
   - `token`
   - `auth`
4. Look in `<script>` tags for token initialization

### Step 10: Check Console for Errors/Logs

1. Go to **Console** tab
2. Look for any error messages
3. Look for any authentication-related logs

## What to Document

Create a text file with:

```
## Login Flow Discovery

### Login Request
- URL:
- Method:
- Headers:
- Body:
- Response Status:
- Response Headers:
- Response Body:

### Token Storage
- access_token found in: [localStorage/sessionStorage/cookie/response body/other]
- access_token value: [first 10 characters]
- authorization found in: [localStorage/sessionStorage/cookie/response body/other]
- authorization value: [first 20 characters]

### Token Usage
- First API call URL:
- Headers sent:

### Additional Notes
- Any redirects?
- Any JavaScript initialization?
- Any cookies set?
```

## Common Patterns to Look For

### Pattern 1: Token in Response Body
```json
{
  "access_token": "abc123...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Pattern 2: Token in Set-Cookie Header
```
Set-Cookie: access_token=abc123...; Path=/; HttpOnly
```

### Pattern 3: Token in JavaScript
```javascript
window.access_token = "abc123...";
localStorage.setItem('access_token', 'abc123...');
```

### Pattern 4: Token in Redirect
```
Location: /dashboard?token=abc123...
```

## Once You Find the Tokens

1. Note EXACTLY where they came from
2. Note the EXACT request that produced them
3. Save all request/response details
4. We can then implement this programmatically in `ipos-auth-service.ts`

## Questions to Answer

- [ ] What HTTP method is used for login?
- [ ] What is the exact login endpoint URL?
- [ ] What fields are sent (email, password, anything else)?
- [ ] Where does the access_token come from?
- [ ] Where does the authorization token come from?
- [ ] Are tokens stored anywhere client-side?
- [ ] How long do tokens last?
- [ ] Is there a token refresh mechanism?
