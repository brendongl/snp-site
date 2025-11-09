#!/usr/bin/env python3
"""
iPOS Session-Based API Access Test
This script proves that we CAN access the API by maintaining the browser session.

Key Insight: Tokens are session-bound!
- Login in browser → tokens are valid in that session
- Extract tokens → use elsewhere → tokens expire/invalid

Solution: Keep the browser session alive and make API calls from within it.
"""

import asyncio
import json
from playwright.async_api import async_playwright
from datetime import datetime

# Configuration (from .env or hardcoded for testing)
IPOS_EMAIL = "sipnplay@ipos.vn"
IPOS_PASSWORD = "123123A"
IPOS_BRAND_UID = "32774afe-fd5c-4028-b837-f91837c0307c"
IPOS_COMPANY_UID = "8a508e04-440f-4145-9429-22b7696c6193"
IPOS_STORE_UID = "72a800a6-1719-4b4b-9065-31ab2e0c07e5"
STORE_OPEN_HOUR = 10


def get_store_opening_timestamp(date=None):
    """Get timestamp in milliseconds for store opening time (10 AM)"""
    if date is None:
        date = datetime.now()

    opening = date.replace(hour=STORE_OPEN_HOUR, minute=0, second=0, microsecond=0)
    return int(opening.timestamp() * 1000)


async def test_session_based_api_access():
    """
    Test accessing iPOS API by maintaining browser session.
    This proves the concept before implementing in Node.js/TypeScript.
    """

    print("\n" + "=" * 60)
    print("iPOS Session-Based API Access Test")
    print("=" * 60 + "\n")

    captured_api_data = None

    async with async_playwright() as p:
        # Launch browser (headless for production, headed for debugging)
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        # Enable network logging
        def handle_response(response):
            nonlocal captured_api_data

            # Look for the sale-summary/overview API call
            if "sale-summary/overview" in response.url:
                print(f"\n🎯 CAPTURED API CALL: {response.url}")
                print(f"   Status: {response.status}")

                # Try to get the JSON response
                try:
                    if response.status == 200:
                        # We need to capture this asynchronously
                        async def capture():
                            nonlocal captured_api_data
                            try:
                                data = await response.json()
                                captured_api_data = data
                                print(f"   ✅ Successfully captured API response!")
                                print(f"   Data preview: {json.dumps(data, indent=2)[:200]}...")
                            except Exception as e:
                                print(f"   ⚠️  Could not parse JSON: {e}")

                        # Schedule the capture
                        asyncio.create_task(capture())
                except Exception as e:
                    print(f"   Error: {e}")

        page.on("response", handle_response)

        print("Step 1: Navigating to login page...")
        await page.goto("https://fabi.ipos.vn/login")

        print("Step 2: Filling in credentials...")
        await page.fill('input[name="email_input"]', IPOS_EMAIL)
        await page.fill('input[type="password"]', IPOS_PASSWORD)

        print("Step 3: Logging in...")
        # Click login and wait for navigation
        async with page.expect_navigation():
            await page.click('button:has-text("Đăng nhập")')

        print("Step 4: Waiting for dashboard to load...")
        try:
            await page.wait_for_selector('text=Doanh thu (NET)', timeout=15000)
            print("   ✓ Dashboard loaded successfully")
        except:
            print("   ⚠ Dashboard selector not found, continuing anyway...")

        print("Step 5: Waiting for API calls to complete...")
        await page.wait_for_timeout(5000)

        print("\n" + "=" * 60)
        print("TEST RESULTS")
        print("=" * 60)

        if captured_api_data:
            print("\n✅ SUCCESS! API data captured from browser session!\n")

            # Extract the important fields
            data = captured_api_data.get("data", {})
            sale_tracking = data.get("sale_tracking", {})

            print("📊 Dashboard Data:")
            print(f"   Unpaid Amount: {sale_tracking.get('total_amount', 0):,} VND")
            print(f"   Today's Revenue (NET): {data.get('revenue_net', 0):,} VND")
            print(f"   Active Tables: {sale_tracking.get('table_count', 0)}")
            print(f"   Current Customers: {sale_tracking.get('people_count', 0)}")

            print("\n🎉 PROOF OF CONCEPT SUCCESSFUL!")
            print("\n💡 Key Findings:")
            print("   1. We CAN access the API by maintaining browser session")
            print("   2. No need to manually capture and manage tokens")
            print("   3. This approach will work on Railway in production")

            print("\n📋 Next Steps:")
            print("   1. Convert this logic to Node.js/TypeScript")
            print("   2. Create a service that maintains browser session")
            print("   3. Extract data from API responses (not HTML)")
            print("   4. Deploy to Railway staging for testing")

        else:
            print("\n❌ FAILED: No API data captured")
            print("\nPossible reasons:")
            print("   1. Dashboard didn't load the API call")
            print("   2. API call was made but response wasn't captured")
            print("   3. Network timing issue")

            print("\n💡 Debugging tips:")
            print("   1. Run with headless=False to see what's happening")
            print("   2. Check network tab in browser DevTools")
            print("   3. Increase wait time after login")

        print("\n" + "=" * 60 + "\n")

        # Keep browser open for manual inspection
        if not captured_api_data:
            print("Browser will stay open for 30 seconds for debugging...")
            await page.wait_for_timeout(30000)

        await browser.close()


if __name__ == "__main__":
    asyncio.run(test_session_based_api_access())
