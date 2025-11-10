#!/usr/bin/env python3
"""
Test script to simulate Nintendo Switch game launch/exit events
"""

import requests
import json
import time
import random

# List of test games to simulate
TEST_GAMES = [
    {
        "title_id": "01002EF01A316000",
        "title_name": "Brotato",
        "title_version": "1.0.1.3"
    },
    {
        "title_id": "0100F2C0115B6000",
        "title_name": "Mario Kart 8 Deluxe",
        "title_version": "3.0.3"
    },
    {
        "title_id": "0100000000010000",
        "title_name": "Super Mario Odyssey",
        "title_version": "1.3.0"
    },
    {
        "title_id": "01006A800016E000",
        "title_name": "Super Smash Bros. Ultimate",
        "title_version": "13.0.2"
    },
    {
        "title_id": "0100E95004038000",
        "title_name": "Zelda: Breath of the Wild",
        "title_version": "1.6.0"
    },
    {
        "title_id": "01008F6008C5E000",
        "title_name": "Pokemon Let's Go Pikachu",
        "title_version": "1.0.2"
    }
]

def send_switch_event(action="Launch", game=None):
    """Send a Switch game event webhook"""

    if game is None:
        game = random.choice(TEST_GAMES)

    payload = {
        "serial": f"XKK1000607{random.randint(1000, 9999)}",
        "hos_version": "20.4.0",
        "ams_version": "1.9.4",
        "action": action,  # "Launch" or "Exit"
        "title_id": game["title_id"],
        "title_version": game["title_version"],
        "title_name": game["title_name"],
        "controller_count": random.randint(1, 4)
    }

    # Send to local Next.js app
    webhook_url = "http://localhost:3000/api/switch-webhook"

    try:
        print(f"\n[{action.upper()}] Sending: {game['title_name']}")
        print(f"Controllers: {payload['controller_count']}")

        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5
        )

        if response.status_code == 200:
            result = response.json()
            print(f"[SUCCESS] Notified {result.get('clients', 0)} clients")
        else:
            print(f"[FAILED] {response.status_code} - {response.text}")

    except requests.exceptions.ConnectionError:
        print(f"[ERROR] Connection failed - is the Next.js server running on port 3000?")
    except Exception as e:
        print(f"[ERROR] {e}")

def main():
    print("=" * 60)
    print("Nintendo Switch Game Event Simulator")
    print("=" * 60)
    print(f"Target: http://localhost:3000/api/switch-webhook")
    print("=" * 60)

    while True:
        print("\nChoose an action:")
        print("1. Simulate game launch (random game)")
        print("2. Simulate game exit (random game)")
        print("3. Simulate quick play session (launch + exit)")
        print("4. Simulate multiple players joining")
        print("5. Send custom event")
        print("0. Exit")

        choice = input("\nEnter choice (0-5): ")

        if choice == "1":
            send_switch_event("Launch")

        elif choice == "2":
            send_switch_event("Exit")

        elif choice == "3":
            game = random.choice(TEST_GAMES)
            print(f"\nSimulating play session for: {game['title_name']}")
            send_switch_event("Launch", game)
            time.sleep(2)
            send_switch_event("Exit", game)

        elif choice == "4":
            game = random.choice(TEST_GAMES)
            print(f"\nSimulating multiple players for: {game['title_name']}")
            # Override controller count to simulate multiple players
            original = game.copy()
            game["controller_count"] = 4
            send_switch_event("Launch", game)

        elif choice == "5":
            print("\nAvailable games:")
            for i, g in enumerate(TEST_GAMES, 1):
                print(f"{i}. {g['title_name']}")

            game_idx = int(input("Select game (1-6): ")) - 1
            action = input("Action (Launch/Exit): ")

            if 0 <= game_idx < len(TEST_GAMES):
                send_switch_event(action, TEST_GAMES[game_idx])
            else:
                print("Invalid game selection")

        elif choice == "0":
            print("\nExiting...")
            break
        else:
            print("Invalid choice")

if __name__ == "__main__":
    # Quick test - send one launch event immediately
    print("\n[TEST] Sending initial test event...")
    send_switch_event("Launch", TEST_GAMES[0])

    print("\n" + "=" * 60)
    input("Press Enter to continue to interactive mode...")

    main()