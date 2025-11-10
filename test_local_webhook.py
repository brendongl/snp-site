#!/usr/bin/env python
"""
Test script to send Switch webhook to LOCAL development server
This bypasses the HTTP bridge and tests the webhook endpoint directly
"""

import requests
import json
import time

# Local development server webhook URL
WEBHOOK_URL = "http://localhost:3000/api/switch-webhook"

def send_webhook(game_name, title_id, action="Launch", controllers=1):
    """Send a test webhook to the local server"""

    payload = {
        "serial": "XKK10006076602",
        "hos_version": "20.4.0",
        "ams_version": "1.9.4",
        "action": action,
        "title_id": title_id,
        "title_version": "1.0.0",
        "title_name": game_name,
        "controller_count": controllers
    }

    print(f"\n{'='*60}")
    print(f"[WEBHOOK] Sending {action} event for: {game_name}")
    print(f"URL: {WEBHOOK_URL}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print('='*60)

    try:
        response = requests.post(
            WEBHOOK_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )

        print(f"[RESPONSE] Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] {data.get('message', 'OK')}")
            print(f"[CLIENTS] Notified {data.get('clients', 0)} connected clients")
        else:
            print(f"[ERROR] {response.text[:200]}")

        return response.status_code == 200

    except requests.exceptions.ConnectionError:
        print("[ERROR] Cannot connect to localhost:3000")
        print("[TIP] Make sure your dev server is running: npm run dev")
        return False
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return False

def main():
    print("\nNintendo Switch Webhook Test Script")
    print("Testing LOCAL development server at http://localhost:3000")
    print("\nMake sure:")
    print("1. Your dev server is running (npm run dev)")
    print("2. You have the website open in a browser to see notifications")

    input("\nPress Enter to start sending test webhooks...")

    # Test sequence of games
    games = [
        ("Mario Kart 8 Deluxe", "0100152000022000", 4),
        ("The Legend of Zelda: Breath of the Wild", "01007EF00011E000", 1),
        ("Super Smash Bros. Ultimate", "01006A800016E000", 8),
        ("Animal Crossing: New Horizons", "01006F8002326000", 1),
        ("Pokemon Sword", "0100ABF008968000", 1),
    ]

    for game_name, title_id, controllers in games:
        # Send Launch event
        if send_webhook(game_name, title_id, "Launch", controllers):
            print(f"[TOAST] You should see: 'Someone just started playing {game_name}'")

            # Wait a bit
            time.sleep(3)

            # Send Exit event
            if send_webhook(game_name, title_id, "Exit", controllers):
                print(f"[TOAST] You should see: 'Someone just finished playing {game_name}'")

        # Wait between games
        time.sleep(2)

    print("\n" + "="*60)
    print("[DONE] Test sequence complete!")
    print("Check your browser for toast notifications")
    print("="*60)

if __name__ == "__main__":
    main()