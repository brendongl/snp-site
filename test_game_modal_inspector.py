"""
Test Game Detail Modal Content Check History - Inspector Display
Tests whether the game modal shows inspector names correctly
"""

from playwright.sync_api import sync_playwright
import time
import sys

# Fix Unicode output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

STAGING_URL = "https://staging-production-c398.up.railway.app"
STAFF_EMAIL = "hoangquangphilong@gmail.com"

def test_game_modal_inspector():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        print("=" * 60)
        print("Testing Game Detail Modal - Inspector Display")
        print("=" * 60)

        try:
            # Step 1: Sign in
            print("\n1. Signing in...")
            page.goto(f"{STAGING_URL}/auth/signin")
            page.wait_for_load_state('networkidle')

            page.fill('input[placeholder*="example.com"]', STAFF_EMAIL)
            page.click('button:has-text("Sign In")')
            page.wait_for_load_state('networkidle')
            print("   ✓ Signed in successfully")

            # Step 2: Navigate to games page and search for a game with content checks
            print("\n2. Navigating to games page...")
            page.goto(f"{STAGING_URL}/games")
            page.wait_for_load_state('networkidle')
            time.sleep(2)  # Wait for games to load
            print("   ✓ Games page loaded")

            # Step 3: Search for "Skyjo" which we know has content checks
            print("\n3. Searching for 'Skyjo'...")
            search_input = page.locator('input[placeholder*="Search"]').first
            search_input.fill('Skyjo')
            page.wait_for_timeout(1000)  # Wait for search to filter
            print("   ✓ Search applied")

            # Step 4: Click on the first game card
            print("\n4. Opening game detail modal...")
            # Take screenshot before clicking
            page.screenshot(path='before_game_click.png', full_page=True)
            print("   ✓ Screenshot saved: before_game_click.png")

            # Find and click the game card
            game_cards = page.locator('[class*="cursor-pointer"]').filter(has_text='Skyjo')
            if game_cards.count() > 0:
                game_cards.first.click()
                page.wait_for_timeout(1000)  # Wait for modal to open
                print("   ✓ Game modal opened")
            else:
                print("   ✗ No Skyjo game card found")
                page.screenshot(path='no_game_found.png', full_page=True)
                print("   ✓ Screenshot saved: no_game_found.png")
                return

            # Step 5: Look for "Check History" tab or button
            print("\n5. Looking for Check History tab...")
            page.screenshot(path='modal_opened.png', full_page=True)
            print("   ✓ Screenshot saved: modal_opened.png")

            # Try to find and click "Check History" or similar tab
            tabs = page.locator('[role="tab"], button, [class*="tab"]')
            check_history_found = False
            for i in range(tabs.count()):
                tab_text = tabs.nth(i).text_content()
                if tab_text and ('Check' in tab_text or 'History' in tab_text or 'Content' in tab_text):
                    print(f"   ✓ Found tab: {tab_text}")
                    tabs.nth(i).click()
                    page.wait_for_timeout(1000)
                    check_history_found = True
                    break

            if not check_history_found:
                print("   ⚠ No Check History tab found, modal might not have content checks")

            # Step 6: Capture the modal content
            print("\n6. Capturing modal content...")
            page.screenshot(path='game_modal_content_checks.png', full_page=True)
            print("   ✓ Screenshot saved: game_modal_content_checks.png")

            # Step 7: Extract inspector information if visible
            print("\n7. Looking for inspector information...")
            inspector_elements = page.locator('text=/inspector/i').all()
            print(f"   Found {len(inspector_elements)} elements mentioning 'inspector'")

            # Look for any text that matches Airtable record IDs (starts with 'rec')
            page_content = page.content()
            if 'rec' in page_content and 'rec' in page_content[page_content.find('rec'):page_content.find('rec')+20]:
                print("   ⚠ WARNING: Possible raw IDs detected (text contains 'rec...')")
                # Extract some context
                import re
                rec_matches = re.findall(r'rec[A-Za-z0-9]{14,}', page_content)
                if rec_matches:
                    print(f"   Found possible record IDs: {rec_matches[:5]}")
            else:
                print("   ✓ No obvious record IDs found in page content")

            print("\n" + "=" * 60)
            print("Test completed!")
            print("Screenshots saved:")
            print("  - before_game_click.png")
            print("  - modal_opened.png")
            print("  - game_modal_content_checks.png")
            print("=" * 60)

        except Exception as e:
            print(f"\n✗ Error during test: {e}")
            page.screenshot(path='error_screenshot.png', full_page=True)
            print("   ✓ Error screenshot saved: error_screenshot.png")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    test_game_modal_inspector()
