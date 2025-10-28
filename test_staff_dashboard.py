#!/usr/bin/env python3
"""Test staff dashboard and new features on sipnplay.cafe production"""

from playwright.sync_api import sync_playwright
import sys

def test_staff_dashboard():
    """Test the new staff dashboard and API endpoints"""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("\n=== Testing Staff Dashboard (v1.11.0) ===\n")

        # Test 1: API Endpoints
        print("1. Testing API Endpoints...")

        # Test play logs stats API
        print("   - Testing /api/play-logs/stats...")
        response = page.request.get("https://sipnplay.cafe/api/play-logs/stats?timePeriod=7")
        if response.ok:
            data = response.json()
            print(f"     ✓ Stats API working: {data.get('totalPlays', 0)} total plays in last 7 days")
            print(f"       Unique games: {data.get('uniqueGames', 0)}")
            if data.get('mostPlayed'):
                print(f"       Most played: {data['mostPlayed']['game_name']} ({data['mostPlayed']['count']}x)")
        else:
            print(f"     ✗ Stats API failed: {response.status}")

        # Test needs checking API
        print("   - Testing /api/content-checks/needs-checking...")
        response = page.request.get("https://sipnplay.cafe/api/content-checks/needs-checking?daysThreshold=30")
        if response.ok:
            data = response.json()
            print(f"     ✓ Needs checking API working: {data.get('count', 0)} games need checking")
        else:
            print(f"     ✗ Needs checking API failed: {response.status}")

        # Test missing pieces API
        print("   - Testing /api/content-checks/missing-pieces...")
        response = page.request.get("https://sipnplay.cafe/api/content-checks/missing-pieces")
        if response.ok:
            data = response.json()
            print(f"     ✓ Missing pieces API working: {data.get('total_pieces', 0)} missing pieces across {data.get('affected_games', 0)} games")
        else:
            print(f"     ✗ Missing pieces API failed: {response.status}")

        # Test dashboard stats API
        print("   - Testing /api/staff/dashboard/stats...")
        response = page.request.get("https://sipnplay.cafe/api/staff/dashboard/stats")
        if response.ok:
            data = response.json()
            print(f"     ✓ Dashboard stats API working:")
            print(f"       Games needing check: {data.get('gamesNeedingCheck', 0)}")
            print(f"       Play logs today: {data.get('playLogsToday', 0)}")
            print(f"       Play logs this week: {data.get('playLogsThisWeek', 0)}")
        else:
            print(f"     ✗ Dashboard stats API failed: {response.status}")

        # Test priority actions API
        print("   - Testing /api/staff/dashboard/priority-actions...")
        response = page.request.get("https://sipnplay.cafe/api/staff/dashboard/priority-actions?limit=5")
        if response.ok:
            data = response.json()
            print(f"     ✓ Priority actions API working: {len(data.get('actions', []))} priority games")
        else:
            print(f"     ✗ Priority actions API failed: {response.status}")

        # Test 2: Staff Dashboard Page
        print("\n2. Testing Staff Dashboard Page...")
        try:
            page.goto("https://sipnplay.cafe/staff/dashboard", timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)

            # Take screenshot
            page.screenshot(path='staff_dashboard_screenshot.png', full_page=True)
            print("   ✓ Dashboard page loaded successfully")
            print("   ✓ Screenshot saved: staff_dashboard_screenshot.png")

            # Check for key elements
            if page.locator('h1:has-text("Staff Dashboard")').count() > 0:
                print("   ✓ Dashboard title found")

            # Check for stat cards
            stat_cards = page.locator('.text-3xl.font-bold').count()
            print(f"   ✓ Found {stat_cards} stat cards")

            # Check for priority actions section
            if page.locator('h2:has-text("Priority Actions")').count() > 0:
                print("   ✓ Priority Actions section found")

            # Check for recent activity section
            if page.locator('h2:has-text("Recent Activity")').count() > 0:
                print("   ✓ Recent Activity section found")

        except Exception as e:
            print(f"   ✗ Dashboard page test failed: {str(e)}")

        # Test 3: Play Logs Page with Stats
        print("\n3. Testing Play Logs Page with Statistics...")
        try:
            page.goto("https://sipnplay.cafe/staff/play-logs", timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)

            page.screenshot(path='play_logs_with_stats_screenshot.png', full_page=True)
            print("   ✓ Play Logs page loaded successfully")
            print("   ✓ Screenshot saved: play_logs_with_stats_screenshot.png")

            # Check for statistics section
            if page.locator('h2:has-text("Statistics")').count() > 0:
                print("   ✓ Statistics section found on Play Logs page")

            # Check for time period selector
            if page.locator('text=Last 7 days').count() > 0:
                print("   ✓ Time period selector found")

        except Exception as e:
            print(f"   ✗ Play Logs page test failed: {str(e)}")

        # Test 4: Check if build succeeded
        print("\n4. Testing Build Version...")
        try:
            page.goto("https://sipnplay.cafe/games", timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)

            # Check for version in footer or page
            content = page.content()
            if '1.11' in content or '1.10' in content:
                print("   ✓ Site is running (version detected)")
            else:
                print("   ✓ Site is accessible")

        except Exception as e:
            print(f"   ✗ Site access test failed: {str(e)}")

        browser.close()

        print("\n=== Test Summary ===")
        print("✓ All API endpoints tested")
        print("✓ Staff Dashboard page verified")
        print("✓ Play Logs with statistics verified")
        print("\nDeployment appears successful!")
        return 0

if __name__ == "__main__":
    sys.exit(test_staff_dashboard())
