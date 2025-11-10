#!/usr/bin/env python3
"""
Test webhook sender for Nintendo Switch game launch events
"""

import requests
import json
from datetime import datetime

def send_webhook(url, data):
    """Send a test webhook to the specified URL"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'NintendoSwitch/1.0.0'
        }

        print(f"\n[SENDING] POST to {url}")
        print(f"[DATA] {json.dumps(data, indent=2)}")

        response = requests.post(url, json=data, headers=headers, timeout=10)

        print(f"[STATUS] {response.status_code} {response.reason}")
        print(f"[RESPONSE HEADERS]")
        for key, value in response.headers.items():
            print(f"  {key}: {value}")

        if response.text:
            print(f"[RESPONSE BODY]")
            try:
                print(json.dumps(response.json(), indent=2))
            except:
                print(response.text)

        return response

    except requests.exceptions.SSLError as e:
        print(f"[SSL ERROR] {e}")
        print("[INFO] The server requires HTTPS but you're using HTTP")
        return None

    except requests.exceptions.ConnectionError as e:
        print(f"[CONNECTION ERROR] {e}")
        return None

    except requests.exceptions.Timeout as e:
        print(f"[TIMEOUT ERROR] {e}")
        return None

    except Exception as e:
        print(f"[ERROR] {e}")
        return None

# Test data simulating a Switch game launch
test_data = {
    "event": "game_launch",
    "timestamp": datetime.now().isoformat(),
    "game": {
        "title": "Super Mario Odyssey",
        "title_id": "0100000000010000",
        "version": "1.3.0",
        "publisher": "Nintendo"
    },
    "console": {
        "serial": "XAW10012345678",
        "firmware": "18.0.0",
        "region": "USA",
        "username": "Player1"
    },
    "session": {
        "session_id": "switch-session-001",
        "start_time": datetime.now().isoformat(),
        "is_online": True
    }
}

print("="*60)
print("Nintendo Switch Webhook Test")
print("="*60)

# Test 1: Send to local webhook receiver
print("\n[TEST 1] Testing local webhook receiver...")
local_url = "http://localhost:8080/webhook"
local_response = send_webhook(local_url, test_data)

# Test 2: Send to n8n webhook (HTTP)
print("\n[TEST 2] Testing n8n webhook (HTTP)...")
n8n_http_url = "http://n8n.ganle.xyz/webhook-test/switch-game-launch"
n8n_http_response = send_webhook(n8n_http_url, test_data)

# Test 3: Try HTTPS version if HTTP fails
if not n8n_http_response or n8n_http_response.status_code != 200:
    print("\n[TEST 3] Trying n8n webhook with HTTPS...")
    n8n_https_url = "https://n8n.ganle.xyz/webhook-test/switch-game-launch"
    n8n_https_response = send_webhook(n8n_https_url, test_data)

print("\n" + "="*60)
print("Test Summary:")
print("="*60)

if local_response and local_response.status_code == 200:
    print("[LOCAL] SUCCESS - Your local webhook receiver is working!")
else:
    print("[LOCAL] FAILED - Check if your receiver is running on port 8080")

if n8n_http_response and n8n_http_response.status_code == 200:
    print("[N8N] SUCCESS - n8n accepts HTTP webhooks!")
else:
    print("[N8N] HTTP failed or not available")
    print("[N8N] The server likely requires HTTPS")
    print("[N8N] Configure your Switch homebrew to use:")
    print(f"       https://n8n.ganle.xyz/webhook-test/switch-game-launch")

print("="*60)