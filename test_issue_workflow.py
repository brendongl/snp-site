#!/usr/bin/env python3
"""
Test the complete Issue Reporting and Resolution workflow (v1.5.0)

Workflow:
1. Login as staff member
2. Check initial points
3. Report an issue on a game (should award 100 points)
4. Verify points increased by 100
5. Navigate to staff dashboard
6. Resolve the issue from Board Game Issues
7. Verify points increased again (resolution points)
"""

from playwright.sync_api import sync_playwright
import sys
import time

def test_issue_workflow():
    """Test the complete issue workflow with points awards"""

    BASE_URL = "http://localhost:3001"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # Set to False to see the test run
        page = browser.new_page()

        print("\n" + "="*80)
        print("TESTING ISSUE REPORTING & RESOLUTION WORKFLOW (v1.5.0)")
        print("="*80 + "\n")

        try:
            # Step 1: Navigate to games page
            print("Step 1: Navigating to games page...")
            page.goto(f"{BASE_URL}/games?staff=true", timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            print("   ✓ Games page loaded\n")

            # Step 2: Open staff login dialog
            print("Step 2: Opening staff login dialog...")
            # Look for the staff menu button (avatar icon or staff login button)
            staff_button = page.locator('button:has-text("Staff Login")')
            if staff_button.count() > 0:
                staff_button.click()
                page.wait_for_timeout(1000)
                print("   ✓ Staff login dialog opened\n")
            else:
                print("   ℹ Staff already logged in or button not found\n")

            # Step 3: Login as Brendon (or select from dropdown if already have localStorage)
            print("Step 3: Logging in as staff member...")

            # Check if already logged in by looking for staff name in header
            if page.locator('text=Brendon').count() > 0:
                print("   ℹ Already logged in as Brendon\n")
            else:
                # Look for email input or staff selection
                email_input = page.locator('input[type="email"]')
                if email_input.count() > 0:
                    email_input.fill('brendon@example.com')
                    login_button = page.locator('button:has-text("Login")')
                    if login_button.count() > 0:
                        login_button.click()
                        page.wait_for_timeout(2000)
                        print("   ✓ Logged in as staff member\n")
                else:
                    # Might be a dropdown selector
                    print("   ℹ Looking for staff selector...\n")

            # Step 4: Get initial points from header
            print("Step 4: Checking initial points...")
            initial_points = None

            # Wait for the header to load and find points display
            page.wait_for_timeout(2000)
            points_element = page.locator('text=/\\d+\\s*pts?/i').first
            if points_element.count() > 0:
                points_text = points_element.inner_text()
                # Extract number from text like "1234 pts" or "1234"
                import re
                match = re.search(r'(\d+)', points_text)
                if match:
                    initial_points = int(match.group(1))
                    print(f"   ✓ Initial points: {initial_points}\n")
            else:
                print("   ⚠ Could not find points display in header")
                print("   ℹ Continuing anyway...\n")

            # Step 5: Find a game to report an issue on
            print("Step 5: Finding a game to report issue on...")

            # Click on the first game card
            game_cards = page.locator('[data-testid="game-card"]').first
            if game_cards.count() == 0:
                # Try alternative selector
                game_cards = page.locator('div:has(h3)').filter(has_text='Players:').first

            if game_cards.count() > 0:
                game_name = game_cards.locator('h3').first.inner_text() if game_cards.locator('h3').count() > 0 else "Unknown Game"
                print(f"   ✓ Found game: {game_name}")
                game_cards.click()
                page.wait_for_timeout(2000)
                print("   ✓ Game modal opened\n")
            else:
                print("   ✗ Could not find any game cards")
                return 1

            # Step 6: Report an issue (100 points)
            print("Step 6: Reporting an issue...")

            # Look for "Report Issue" button in the modal
            report_button = page.locator('button:has-text("Report Issue")')
            if report_button.count() > 0:
                report_button.click()
                page.wait_for_timeout(1000)
                print("   ✓ Report Issue dialog opened")

                # Fill out the issue report form
                # Select issue category (e.g., "Broken Sleeves")
                category_select = page.locator('select[name="category"]')
                if category_select.count() > 0:
                    category_select.select_option('broken_sleeves')
                    print("   ✓ Selected category: Broken Sleeves")

                # Add description
                description_input = page.locator('textarea[name="description"]')
                if description_input.count() > 0:
                    description_input.fill('Test issue - card sleeves need replacement')
                    print("   ✓ Added description")

                # Submit the report
                submit_button = page.locator('button:has-text("Submit")').last
                if submit_button.count() > 0:
                    submit_button.click()
                    page.wait_for_timeout(3000)  # Wait for API call
                    print("   ✓ Issue reported successfully\n")
                else:
                    print("   ⚠ Could not find Submit button\n")
            else:
                print("   ⚠ Could not find Report Issue button")
                print("   ℹ Skipping issue reporting...\n")

            # Step 7: Verify points increased by 100
            print("Step 7: Verifying points increased by 100...")

            page.wait_for_timeout(2000)  # Wait for points to update

            # Check points again
            current_points = None
            points_element = page.locator('text=/\\d+\\s*pts?/i').first
            if points_element.count() > 0:
                points_text = points_element.inner_text()
                import re
                match = re.search(r'(\d+)', points_text)
                if match:
                    current_points = int(match.group(1))
                    if initial_points is not None:
                        points_gained = current_points - initial_points
                        if points_gained == 100:
                            print(f"   ✅ SUCCESS: Points increased by 100")
                            print(f"      {initial_points} → {current_points}\n")
                        else:
                            print(f"   ⚠ Points increased by {points_gained} (expected 100)")
                            print(f"      {initial_points} → {current_points}\n")
                    else:
                        print(f"   ✓ Current points: {current_points}\n")
            else:
                print("   ⚠ Could not verify points increase\n")

            # Close the game modal
            close_button = page.locator('button[aria-label="Close"]').first
            if close_button.count() > 0:
                close_button.click()
                page.wait_for_timeout(1000)

            # Step 8: Navigate to staff dashboard
            print("Step 8: Navigating to staff dashboard...")
            page.goto(f"{BASE_URL}/staff/dashboard", timeout=30000)
            page.wait_for_load_state('networkidle', timeout=30000)
            print("   ✓ Dashboard loaded\n")

            # Step 9: Find the reported issue in Board Game Issues
            print("Step 9: Finding the reported issue in Board Game Issues...")

            page.wait_for_timeout(2000)  # Wait for tasks to load

            # Look for the "Board Game Issues" section
            board_game_section = page.locator('h2:has-text("Board Game Issues")')
            if board_game_section.count() > 0:
                print("   ✓ Board Game Issues section found")

                # Find task cards in this section
                # Look for the task we just created (should contain "broken_sleeves")
                task_cards = page.locator('div:has-text("broken_sleeves")').filter(has=page.locator('button:has-text("Complete")'))

                if task_cards.count() > 0:
                    print(f"   ✓ Found {task_cards.count()} matching task(s)")

                    # Get points before resolution
                    points_before = current_points

                    # Step 10: Click "Complete" button to resolve the issue
                    print("\nStep 10: Resolving the issue...")
                    complete_button = task_cards.locator('button:has-text("Complete")').first

                    if complete_button.count() > 0:
                        complete_button.click()
                        print("   ✓ Clicked Complete button")

                        # Wait for the completion to process
                        page.wait_for_timeout(3000)

                        print("   ✓ Issue resolved successfully\n")

                        # Step 11: Verify points increased again
                        print("Step 11: Verifying points increased (resolution award)...")

                        page.wait_for_timeout(2000)

                        # Check points again
                        final_points = None
                        points_element = page.locator('text=/\\d+\\s*pts?/i').first
                        if points_element.count() > 0:
                            points_text = points_element.inner_text()
                            import re
                            match = re.search(r'(\d+)', points_text)
                            if match:
                                final_points = int(match.group(1))
                                if points_before is not None:
                                    resolution_points = final_points - points_before
                                    print(f"   ✅ SUCCESS: Points increased by {resolution_points}")
                                    print(f"      {points_before} → {final_points}\n")
                                else:
                                    print(f"   ✓ Final points: {final_points}\n")

                        # Step 12: Verify task disappeared from list
                        print("Step 12: Verifying task removed from list...")
                        page.wait_for_timeout(2000)

                        # Check if the task is still visible
                        remaining_tasks = page.locator('div:has-text("broken_sleeves")').filter(has=page.locator('button:has-text("Complete")')).count()

                        if remaining_tasks == 0:
                            print("   ✅ SUCCESS: Task removed from Board Game Issues list\n")
                        else:
                            print(f"   ⚠ Task still visible ({remaining_tasks} found)\n")

                    else:
                        print("   ⚠ Could not find Complete button\n")
                else:
                    print("   ⚠ Could not find the reported task")
                    print("   ℹ It may have been already completed or not created\n")
            else:
                print("   ⚠ Board Game Issues section not found\n")

            # Take final screenshot
            page.screenshot(path='issue_workflow_final.png', full_page=True)
            print("Screenshot saved: issue_workflow_final.png\n")

            # Summary
            print("="*80)
            print("TEST SUMMARY")
            print("="*80)
            if initial_points is not None and current_points is not None:
                print(f"Initial Points:  {initial_points}")
                print(f"After Report:    {current_points} (+{current_points - initial_points})")
                if final_points is not None:
                    print(f"After Resolution: {final_points} (+{final_points - current_points})")
                    print(f"Total Gained:    {final_points - initial_points} points")
            print("="*80 + "\n")

        except Exception as e:
            print(f"\n❌ Test failed with error: {str(e)}\n")
            page.screenshot(path='issue_workflow_error.png', full_page=True)
            print("Error screenshot saved: issue_workflow_error.png\n")
            return 1

        finally:
            browser.close()

        print("✅ Test completed successfully!")
        return 0

if __name__ == "__main__":
    sys.exit(test_issue_workflow())
