#!/usr/bin/env python
"""
Nintendo Switch Webhook Production Tester
Simulates the exact payload your Switch sends to test the production webhook
"""

import requests
import json
import time
import sys

# Production webhook URL
PRODUCTION_URL = "https://sipnplay.cafe/api/switch-webhook"

# You can override this with staging or other URLs
WEBHOOK_URL = PRODUCTION_URL

def send_switch_webhook(action="Launch", title_name="Brotato", title_id="01002EF01A316000", controllers=2):
    """Send a webhook exactly like your Nintendo Switch would"""

    # Exact payload format from your Switch
    payload = {
        "serial": "XKK10006076602",
        "hos_version": "20.4.0",
        "ams_version": "1.9.4",
        "action": action,
        "title_id": title_id,
        "title_version": "1.0.1.3",
        "title_name": title_name,
        "controller_count": controllers
    }

    print(f"\n{'='*60}")
    print(f"[SWITCH] Simulating Nintendo Switch Webhook")
    print(f"{'='*60}")
    print(f"URL: {WEBHOOK_URL}")
    print(f"Action: {action}")
    print(f"Game: {title_name}")
    print(f"Controllers: {controllers}")
    print(f"{'='*60}")

    try:
        print(f"[SENDING] POST request...")
        response = requests.post(
            WEBHOOK_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )

        print(f"[STATUS] {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] {data.get('message', 'Webhook received')}")
            print(f"[CLIENTS] {data.get('clients', 0)} clients notified")
            return True
        else:
            print(f"[ERROR] Server returned: {response.status_code}")
            print(f"[BODY] {response.text[:500]}")
            return False

    except requests.exceptions.SSLError:
        print("[SSL ERROR] The server has SSL certificate issues")
        print("[TIP] This is why your Switch can't connect directly!")
        print("[SOLUTION] Use the HTTP bridge or Cloudflare Tunnel")
        return False
    except requests.exceptions.ConnectionError:
        print("[CONNECTION ERROR] Cannot reach the server")
        print("[TIP] Check if the webhook endpoint is deployed")
        return False
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return False

def test_game_sequence():
    """Test a sequence of game launches and exits like your Switch would"""

    games = [
        ("Super Smash Bros. Ultimate", "01006A800016E000", 4),
        ("The Legend of Zelda: Breath of the Wild", "01007EF00011E000", 1),
        ("Mario Kart 8 Deluxe", "0100152000022000", 2),
        ("Hades II", "0100A00019DE0000", 1),
        ("PATAPON 1+2 REPLAY", "01006DC020DB8000", 2),
    ]

    print("\n" + "="*60)
    print("Starting game sequence test...")
    print("This simulates your Switch launching and exiting games")
    print("="*60)

    for game_name, title_id, controllers in games:
        # Launch the game
        print(f"\n[GAME] Launching {game_name}...")
        if send_switch_webhook("Launch", game_name, title_id, controllers):
            print(f"[NOTIFICATION] Users should see: 'Someone just started playing {game_name}'")

        # Simulate playing for 2 seconds
        time.sleep(2)

        # Exit the game
        print(f"\n[GAME] Exiting {game_name}...")
        if send_switch_webhook("Exit", game_name, title_id, controllers):
            print(f"[NOTIFICATION] Users should see: 'Someone just finished playing {game_name}'")

        # Wait before next game
        time.sleep(1)

def main():
    print("\n" + "="*60)
    print("NINTENDO SWITCH WEBHOOK PRODUCTION TESTER")
    print("="*60)
    print(f"Target: {WEBHOOK_URL}")
    print("\nThis script simulates the exact webhook payload your Switch sends")
    print("\nOptions:")
    print("1. Send single test webhook (Brotato launch)")
    print("2. Send game sequence (5 games launch/exit)")
    print("3. Custom webhook")
    print("4. Exit")

    while True:
        choice = input("\nSelect option (1-4): ").strip()

        if choice == "1":
            # Single test
            send_switch_webhook("Launch", "Brotato", "01002EF01A316000", 2)
            time.sleep(2)
            send_switch_webhook("Exit", "Brotato", "01002EF01A316000", 2)

        elif choice == "2":
            # Game sequence
            test_game_sequence()

        elif choice == "3":
            # Custom
            game = input("Game name: ").strip() or "Test Game"
            action = input("Action (Launch/Exit): ").strip() or "Launch"
            controllers = int(input("Controllers (1-8): ").strip() or "1")
            send_switch_webhook(action, game, "0100000000000000", controllers)

        elif choice == "4":
            print("\nExiting...")
            break
        else:
            print("Invalid option")

if __name__ == "__main__":
    # Check for command line arguments to override URL
    if len(sys.argv) > 1:
        WEBHOOK_URL = sys.argv[1]
        print(f"Using custom URL: {WEBHOOK_URL}")

    main()