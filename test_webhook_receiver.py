#!/usr/bin/env python3
"""
Nintendo Switch Webhook Receiver
Test server to receive POST webhooks from Switch homebrew
"""

import json
import socket
from datetime import datetime
from flask import Flask, request, jsonify
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

app = Flask(__name__)

# Store received webhooks for inspection
webhook_history = []

def get_local_ip():
    """Get the local network IP address"""
    try:
        # Create a socket to get the local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        # Connect to an external server (doesn't actually connect, just gets the route)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return '127.0.0.1'

@app.route('/')
def home():
    """Home page showing webhook status"""
    return f"""
    <html>
    <head>
        <title>Switch Webhook Receiver</title>
        <style>
            body {{
                font-family: monospace;
                padding: 20px;
                background: #1a1a1a;
                color: #00ff00;
            }}
            .webhook {{
                background: #2a2a2a;
                border: 1px solid #00ff00;
                padding: 10px;
                margin: 10px 0;
                border-radius: 5px;
            }}
            pre {{
                background: #0a0a0a;
                padding: 10px;
                overflow-x: auto;
            }}
        </style>
        <meta http-equiv="refresh" content="5">
    </head>
    <body>
        <h1>[SWITCH] Nintendo Switch Webhook Receiver</h1>
        <p>Status: <strong>RUNNING</strong></p>
        <p>Webhook URL: <code>http://{get_local_ip()}:8080/webhook</code></p>
        <p>Total webhooks received: {len(webhook_history)}</p>
        <p><em>This page auto-refreshes every 5 seconds</em></p>

        <h2>Recent Webhooks (last 10):</h2>
        {''.join([f'<div class="webhook"><strong>{w["timestamp"]}</strong><pre>{json.dumps(w["data"], indent=2)}</pre></div>' for w in webhook_history[-10:][::-1]]) if webhook_history else '<p>No webhooks received yet...</p>'}
    </body>
    </html>
    """

@app.route('/webhook', methods=['POST'])
def webhook():
    """Receive POST webhook from Nintendo Switch"""
    try:
        # Get all possible data formats
        raw_data = request.get_data(as_text=True)

        # Try to parse as JSON if content-type suggests it
        json_data = None
        if request.is_json:
            json_data = request.get_json()

        # Get headers for debugging
        headers = dict(request.headers)

        # Get query parameters if any
        args = dict(request.args)

        # Get form data if sent as form
        form_data = dict(request.form) if request.form else None

        # Create webhook entry
        webhook_entry = {
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'data': {
                'json_body': json_data,
                'raw_body': raw_data if not json_data else None,
                'form_data': form_data,
                'query_params': args if args else None,
                'headers': headers,
                'method': request.method,
                'content_type': request.content_type,
                'remote_addr': request.remote_addr
            }
        }

        # Clean up None values
        webhook_entry['data'] = {k: v for k, v in webhook_entry['data'].items() if v is not None}

        # Store in history
        webhook_history.append(webhook_entry)

        # Keep only last 100 webhooks in memory
        if len(webhook_history) > 100:
            webhook_history.pop(0)

        # Log to console with colors
        print(f"\n{'='*60}")
        print(f"[GAME] WEBHOOK RECEIVED at {webhook_entry['timestamp']}")
        print(f"{'='*60}")
        print(f"From: {request.remote_addr}")
        print(f"Content-Type: {request.content_type}")

        if json_data:
            print(f"\nJSON Data:")
            print(json.dumps(json_data, indent=2))
        elif raw_data:
            print(f"\nRaw Data:")
            print(raw_data)

        if form_data:
            print(f"\nForm Data:")
            print(json.dumps(form_data, indent=2))

        if args:
            print(f"\nQuery Parameters:")
            print(json.dumps(args, indent=2))

        print(f"{'='*60}\n")

        # Return success response
        return jsonify({
            'status': 'success',
            'message': 'Webhook received',
            'timestamp': webhook_entry['timestamp']
        }), 200

    except Exception as e:
        logging.error(f"Error processing webhook: {str(e)}")
        print(f"[ERROR]: {str(e)}")

        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/clear', methods=['POST'])
def clear_history():
    """Clear webhook history"""
    webhook_history.clear()
    return jsonify({'status': 'success', 'message': 'History cleared'}), 200

@app.route('/test', methods=['GET', 'POST'])
def test_endpoint():
    """Test endpoint to verify server is working"""
    return jsonify({
        'status': 'ok',
        'message': 'Test endpoint working',
        'method': request.method,
        'timestamp': datetime.now().isoformat()
    }), 200

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 8080

    print(f"\n{'='*60}")
    print(f"[SWITCH] Nintendo Switch Webhook Receiver")
    print(f"{'='*60}")
    print(f"[OK] Server starting on HTTP (not HTTPS)")
    print(f"\n[URLs] Local URLs:")
    print(f"   - http://localhost:{port}/webhook")
    print(f"   - http://127.0.0.1:{port}/webhook")
    print(f"   - http://{local_ip}:{port}/webhook  <-- Use this on your Switch!")
    print(f"\n[WEB] Web Dashboard:")
    print(f"   - http://localhost:{port}/")
    print(f"\n[TEST] Test endpoint:")
    print(f"   - http://{local_ip}:{port}/test")
    print(f"\n[TIPS] Tips:")
    print(f"   - Make sure your Switch is on the same network")
    print(f"   - Use the IP address URL ({local_ip}) in your homebrew")
    print(f"   - Check firewall settings if connection fails")
    print(f"   - Dashboard auto-refreshes every 5 seconds")
    print(f"{'='*60}\n")

    # Run the server
    # Use 0.0.0.0 to listen on all network interfaces
    app.run(host='0.0.0.0', port=port, debug=True)