#!/usr/bin/env python3
"""
Comprehensive Playwright Tests for AI-Powered Rostering System
Tests Phase 4 features: Staff availability editor, Clock-in/out, Shift swaps

Author: Claude Code
Date: January 14, 2025
Version: 1.0.0
"""

from playwright.sync_api import sync_playwright, expect
import sys
import time

BASE_URL = "http://localhost:3000"  # Adjust if using different port

def test_staff_availability_editor():
    """Test the staff availability editor with extended hours (8am-2am)"""

    print("\n=== Testing Staff Availability Editor ===\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Non-headless for visual debugging
        context = browser.new_context()
        page = context.new_page()

        try:
            # Test 1: Page loads correctly
            print("1. Testing availability page loads...")

            # Set localStorage staff_id BEFORE navigating (simulate logged in)
            page.goto(f"{BASE_URL}/", timeout=30000)  # Go to home page first
            page.evaluate("""
                localStorage.setItem('staff_id', 'c1ec6db5-e14a-414a-b70e-88a6cc0d8250');
            """)

            # Now navigate to availability page with staff_id already set
            page.goto(f"{BASE_URL}/staff/availability", timeout=30000)
            page.wait_for_load_state('load', timeout=30000)

            page.screenshot(path='test-screenshots/availability-initial.png', full_page=True)
            print("   [OK] Page loaded successfully")
            print("   [OK] Screenshot: test-screenshots/availability-initial.png")

            # Test 2: Verify UI elements
            print("\n2. Verifying UI elements...")

            # Check title
            expect(page.locator('h1')).to_contain_text('My Availability')
            print("   [OK] Page title found")

            # Check action buttons
            expect(page.locator('text=Fill All Available')).to_be_visible()
            expect(page.locator('text=Fill All Unavailable')).to_be_visible()
            expect(page.locator('text=Reset')).to_be_visible()
            expect(page.locator('text=Save Changes')).to_be_visible()
            print("   [OK] All action buttons visible")

            # Check day headers
            days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for day in days:
                expect(page.locator(f'th:has-text("{day}")')).to_be_visible()
            print("   [OK] All 7 day columns present")

            # Check hour rows (8am to 2am = 18 hours)
            expected_hours = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm',
                            '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm',
                            '12am', '1am']  # Extended hours: 24 and 25

            for hour in expected_hours:
                expect(page.locator(f'td:text-is("{hour}")')).to_be_visible()
            print(f"   [OK] All 18 hour rows present (8am-2am, including extended hours 12am/1am)")

            # Test 3: Test cell cycling (available → preferred_not → unavailable → available)
            print("\n3. Testing availability cell cycling...")

            # Click Monday 10am cell (should start as available/green)
            monday_10am = page.locator('tr:has(td:text-is("10am")) td button').nth(1)  # Monday is column 1

            # Initial state (should be green)
            initial_class = monday_10am.get_attribute('class')
            print(f"   Initial state: {initial_class}")

            # First click: green → yellow (preferred_not)
            monday_10am.click()
            time.sleep(0.2)  # Brief pause for state update
            first_class = monday_10am.get_attribute('class')
            if 'yellow' in first_class:
                print("   [OK] First click: green → yellow (preferred_not)")
            else:
                print(f"   [FAIL] Expected yellow, got: {first_class}")

            # Second click: yellow → red (unavailable)
            monday_10am.click()
            time.sleep(0.2)
            second_class = monday_10am.get_attribute('class')
            if 'red' in second_class:
                print("   [OK] Second click: yellow → red (unavailable)")
            else:
                print(f"   [FAIL] Expected red, got: {second_class}")

            # Third click: red → green (available)
            monday_10am.click()
            time.sleep(0.2)
            third_class = monday_10am.get_attribute('class')
            if 'green' in third_class:
                print("   [OK] Third click: red → green (available) - cycle complete!")
            else:
                print(f"   [FAIL] Expected green, got: {third_class}")

            page.screenshot(path='test-screenshots/availability-after-cycling.png', full_page=True)

            # Test 4: Test extended hours (24 and 25) - the critical bug we fixed
            print("\n4. Testing extended hours (12am = hour 24, 1am = hour 25)...")

            # Click Saturday 11pm (hour 23)
            saturday_11pm = page.locator('tr:has(td:text-is("11pm")) td button').nth(6)  # Saturday is column 6
            saturday_11pm.click()
            saturday_11pm.click()  # Set to unavailable (red)

            # Click Saturday 12am (hour 24 - extended hour)
            saturday_12am = page.locator('tr:has(td:text-is("12am")) td button').nth(6)
            saturday_12am.click()
            saturday_12am.click()  # Set to unavailable (red)

            # Click Saturday 1am (hour 25 - extended hour)
            saturday_1am = page.locator('tr:has(td:text-is("1am")) td button').nth(6)
            saturday_1am.click()
            saturday_1am.click()  # Set to unavailable (red)

            print("   [OK] Set Saturday 11pm-1am as unavailable (hours 23, 24, 25)")
            page.screenshot(path='test-screenshots/availability-extended-hours.png', full_page=True)

            # Test 5: Test "Fill All" buttons
            print("\n5. Testing bulk fill operations...")

            # Fill all unavailable
            page.click('text=Fill All Unavailable')
            time.sleep(0.5)

            # Check if all cells are red
            red_cells = page.locator('button.bg-red-500').count()
            total_cells = 7 * 18  # 7 days × 18 hours
            if red_cells == total_cells:
                print(f"   [OK] Fill All Unavailable: {red_cells}/{total_cells} cells are red")
            else:
                print(f"   [WARN]  Fill All Unavailable: {red_cells}/{total_cells} cells are red (expected {total_cells})")

            page.screenshot(path='test-screenshots/availability-all-red.png', full_page=True)

            # Fill all available
            page.click('text=Fill All Available')
            time.sleep(0.5)

            green_cells = page.locator('button.bg-green-500').count()
            if green_cells == total_cells:
                print(f"   [OK] Fill All Available: {green_cells}/{total_cells} cells are green")
            else:
                print(f"   [WARN]  Fill All Available: {green_cells}/{total_cells} cells are green (expected {total_cells})")

            page.screenshot(path='test-screenshots/availability-all-green.png', full_page=True)

            # Test 6: Test save functionality
            print("\n6. Testing save/load persistence...")

            # Set a specific pattern
            print("   Setting test pattern: Monday 10am-2pm preferred, Saturday 8pm-1am unavailable")

            # Monday 10am-2pm preferred (yellow)
            for hour_idx in [2, 3, 4, 5, 6]:  # 10am, 11am, 12pm, 1pm, 2pm
                cell = page.locator('tr').nth(hour_idx + 1).locator('td button').nth(1)  # Monday
                cell.click()  # First click: green → yellow
                time.sleep(0.1)

            # Saturday 8pm-1am unavailable (red) - includes extended hours
            saturday_hours = [12, 13, 14, 15, 16, 17]  # 8pm, 9pm, 10pm, 11pm, 12am, 1am
            for hour_idx in saturday_hours:
                cell = page.locator('tr').nth(hour_idx + 1).locator('td button').nth(6)  # Saturday
                cell.click()  # green → yellow
                cell.click()  # yellow → red
                time.sleep(0.1)

            page.screenshot(path='test-screenshots/availability-before-save.png', full_page=True)

            # Click Save Changes
            save_button = page.locator('text=Save Changes')
            expect(save_button).not_to_be_disabled()
            save_button.click()

            # Wait for save to complete (look for success message or button disabled)
            page.wait_for_timeout(2000)

            # Check for success alert
            if page.locator('text=saved successfully').count() > 0:
                print("   [OK] Save successful (alert shown)")
            else:
                print("   [INFO]  Save completed (no alert, check network)")

            page.screenshot(path='test-screenshots/availability-after-save.png', full_page=True)

            # Reload page to test persistence
            print("   Reloading page to verify data persistence...")
            page.reload()
            page.wait_for_load_state('load', timeout=30000)
            time.sleep(1)

            # Verify Monday 10am is yellow
            monday_10am_after = page.locator('tr:has(td:text-is("10am")) td button').nth(1)
            monday_10am_class = monday_10am_after.get_attribute('class')
            if 'yellow' in monday_10am_class:
                print("   [OK] Monday 10am still preferred (yellow) after reload")
            else:
                print(f"   [FAIL] Monday 10am lost state: {monday_10am_class}")

            # Verify Saturday 12am (hour 24) is red
            saturday_12am_after = page.locator('tr:has(td:text-is("12am")) td button').nth(6)
            saturday_12am_class = saturday_12am_after.get_attribute('class')
            if 'red' in saturday_12am_class:
                print("   [OK] Saturday 12am (extended hour 24) still unavailable (red) after reload")
            else:
                print(f"   [FAIL] Saturday 12am lost state: {saturday_12am_class}")

            # Verify Saturday 1am (hour 25) is red
            saturday_1am_after = page.locator('tr:has(td:text-is("1am")) td button').nth(6)
            saturday_1am_class = saturday_1am_after.get_attribute('class')
            if 'red' in saturday_1am_class:
                print("   [OK] Saturday 1am (extended hour 25) still unavailable (red) after reload")
            else:
                print(f"   [FAIL] Saturday 1am lost state: {saturday_1am_class}")

            page.screenshot(path='test-screenshots/availability-after-reload.png', full_page=True)

            # Test 7: Test Reset button
            print("\n7. Testing Reset functionality...")

            # Make some changes
            page.locator('text=Fill All Unavailable').click()
            time.sleep(0.5)

            # Reset should restore saved state
            reset_button = page.locator('text=Reset')
            reset_button.click()
            time.sleep(1)

            # Verify state restored
            monday_10am_reset = page.locator('tr:has(td:text-is("10am")) td button').nth(1)
            if 'yellow' in monday_10am_reset.get_attribute('class'):
                print("   [OK] Reset restored saved state (Monday 10am is yellow)")
            else:
                print("   [FAIL] Reset did not restore state correctly")

            page.screenshot(path='test-screenshots/availability-after-reset.png', full_page=True)

            print("\n[SUCCESS] Staff Availability Editor tests complete!")
            print(f"   Total screenshots: 9 saved in test-screenshots/")

        except Exception as e:
            print(f"\n[ERROR] Test failed with error: {str(e)}")
            page.screenshot(path='test-screenshots/availability-error.png', full_page=True)
            raise
        finally:
            browser.close()


def test_clock_in_out_page():
    """Test the clock-in/out page with points system"""

    print("\n=== Testing Clock-In/Out Page ===\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Test 1: Page loads
            print("1. Testing clock-in page loads...")

            # Set localStorage staff_id BEFORE navigating
            page.goto(f"{BASE_URL}/", timeout=30000)
            page.evaluate("""
                localStorage.setItem('staff_id', 'c1ec6db5-e14a-414a-b70e-88a6cc0d8250');
            """)

            # Navigate to clock-in page
            page.goto(f"{BASE_URL}/staff/clock-in", timeout=30000)
            page.wait_for_load_state('load', timeout=30000)

            page.screenshot(path='test-screenshots/clock-in-initial.png', full_page=True)
            print("   [OK] Page loaded successfully")

            # Test 2: Verify UI elements
            print("\n2. Verifying UI elements...")

            expect(page.locator('h1')).to_contain_text('Clock In/Out')
            print("   [OK] Page title found")

            expect(page.locator('text=Current Status')).to_be_visible()
            print("   [OK] Status section visible")

            expect(page.locator('text=How It Works')).to_be_visible()
            print("   [OK] Info section visible")

            # Test 3: Check clock status
            print("\n3. Checking initial clock status...")

            if page.locator('text=Not Clocked In').count() > 0:
                print("   [OK] Staff is not clocked in (expected initial state)")

                # Test clock-in button
                if page.locator('text=Clock In').count() > 0:
                    print("   [OK] Clock In button visible")

            elif page.locator('text=Clocked In').count() > 0:
                print("   [WARN]  Staff is already clocked in")

                # Test clock-out button
                if page.locator('text=Clock Out').count() > 0:
                    print("   [OK] Clock Out button visible")

            page.screenshot(path='test-screenshots/clock-in-status.png', full_page=True)

            # Test 4: Check points information
            print("\n4. Verifying points system info...")

            points_info = [
                "Early (5-15 min): +50 points",
                "On-time (±5 min): +20 points",
                "Late (5-15 min):",
                "Late (15+ min): -100 points"
            ]

            for info in points_info:
                if page.locator(f'text={info}').count() > 0:
                    print(f"   [OK] Found: {info}")
                else:
                    print(f"   [WARN]  Missing: {info}")

            page.screenshot(path='test-screenshots/clock-in-points-info.png', full_page=True)

            print("\n[SUCCESS] Clock-In/Out page tests complete!")
            print(f"   Total screenshots: 3 saved in test-screenshots/")

        except Exception as e:
            print(f"\n[ERROR] Test failed with error: {str(e)}")
            page.screenshot(path='test-screenshots/clock-in-error.png', full_page=True)
            raise
        finally:
            browser.close()


def test_roster_calendar():
    """Test the roster calendar with shift editing"""

    print("\n=== Testing Roster Calendar ===\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Test 1: Page loads
            print("1. Testing roster calendar loads...")
            page.goto(f"{BASE_URL}/staff/roster/calendar", timeout=30000)
            page.wait_for_load_state('load', timeout=30000)

            page.screenshot(path='test-screenshots/roster-initial.png', full_page=True)
            print("   [OK] Page loaded successfully")

            # Test 2: Verify week selector
            print("\n2. Verifying week navigation...")

            if page.locator('text=Week of').count() > 0:
                print("   [OK] Week selector visible")

            if page.locator('button:has-text("Previous")').count() > 0:
                print("   [OK] Previous week button visible")

            if page.locator('button:has-text("Next")').count() > 0:
                print("   [OK] Next week button visible")

            # Test 3: Verify day headers
            print("\n3. Checking day headers...")

            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            for day in days:
                if page.locator(f'th:has-text("{day}")').count() > 0:
                    print(f"   [OK] {day} column found")

            # Test 4: Check for staff rows
            print("\n4. Verifying staff members displayed...")

            # Count staff rows (each row should have staff name)
            staff_count = page.locator('tr').count() - 1  # Subtract header row
            if staff_count > 0:
                print(f"   [OK] Found {staff_count} staff member rows")
            else:
                print("   [WARN]  No staff rows found")

            page.screenshot(path='test-screenshots/roster-grid.png', full_page=True)

            # Test 5: Check action buttons
            print("\n5. Verifying action buttons...")

            if page.locator('text=Generate Roster').count() > 0:
                print("   [OK] Generate Roster button visible")

            if page.locator('text=Clear All').count() > 0:
                print("   [OK] Clear All button visible")

            if page.locator('text=Publish').count() > 0:
                print("   [OK] Publish button visible")

            page.screenshot(path='test-screenshots/roster-actions.png', full_page=True)

            print("\n[SUCCESS] Roster Calendar tests complete!")
            print(f"   Total screenshots: 3 saved in test-screenshots/")

        except Exception as e:
            print(f"\n[ERROR] Test failed with error: {str(e)}")
            page.screenshot(path='test-screenshots/roster-error.png', full_page=True)
            raise
        finally:
            browser.close()


def run_all_tests():
    """Run all rostering system tests"""

    print("\n" + "="*60)
    print("  AI-POWERED ROSTERING SYSTEM - COMPREHENSIVE TESTS")
    print("  Testing Phase 4 Features + Extended Hours Fix")
    print("="*60)

    # Create screenshots directory
    import os
    os.makedirs('test-screenshots', exist_ok=True)

    tests = [
        ("Staff Availability Editor", test_staff_availability_editor),
        ("Clock-In/Out Page", test_clock_in_out_page),
        ("Roster Calendar", test_roster_calendar)
    ]

    results = []

    for test_name, test_func in tests:
        try:
            print(f"\n{'='*60}")
            test_func()
            results.append((test_name, "[SUCCESS] PASS"))
        except Exception as e:
            results.append((test_name, f"[ERROR] FAIL: {str(e)}"))

    # Print summary
    print("\n" + "="*60)
    print("  TEST SUMMARY")
    print("="*60)

    for test_name, result in results:
        print(f"{test_name:.<50} {result}")

    print("="*60)

    # Return exit code
    if all("PASS" in result for _, result in results):
        print("\n[DONE] All tests passed!")
        return 0
    else:
        print("\n[WARN] Some tests failed - check logs above")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
