# Nintendo Switch Webhook Notifications

**Version Added**: 1.7.12
**Date**: November 10, 2025
**Status**: ✅ Production Ready

## Overview

Real-time toast notifications that appear when someone launches or exits a game on their Nintendo Switch. These notifications broadcast to all website visitors simultaneously using Server-Sent Events (SSE).

## Features

### 🎮 Real-Time Game Notifications
- **Launch Notifications**: "Someone just started playing [Game Name]" with green indicator
- **Exit Notifications**: "Someone just finished playing [Game Name]" with orange indicator
- Toast appears in bottom-left corner for 5 seconds
- Shows game thumbnail when available in video games database
- Displays controller count for multiplayer sessions

### 📡 Broadcasting System
- Server-Sent Events (SSE) for real-time push notifications
- All connected users see notifications simultaneously
- Automatic reconnection if connection drops
- No polling - efficient push-based updates

### 🔗 Static Webhook URL
```
https://sipnplay.cafe/api/switch-webhook
```
This URL is permanent and will never change as long as the domain remains the same.

## Technical Architecture

### Components

1. **Webhook Endpoint** (`/api/switch-webhook`)
   - Receives POST requests from Nintendo Switch homebrew
   - Matches game names with video games database for thumbnails
   - Broadcasts notifications to all connected clients

2. **SSE Endpoint** (`/api/switch-notifications`)
   - Maintains persistent connections with all website visitors
   - Pushes notifications in real-time
   - Handles connection management and cleanup

3. **Toast Component** (`SwitchGameToast.tsx`)
   - Client-side React component
   - Connects to SSE endpoint on mount
   - Displays toast notifications with animations
   - Auto-dismisses after 5 seconds

4. **Notification Service** (`switch-notifier.ts`)
   - Singleton pattern for managing connections
   - Broadcasts events to all connected clients
   - Handles dead connection cleanup

5. **Configuration Page** (`/switch-webhook-config`)
   - Admin-only page showing webhook URL
   - Test button for sending sample notifications
   - Displays expected webhook payload format

## Webhook Payload Format

The Nintendo Switch homebrew should send a POST request with this JSON structure:

```json
{
  "serial": "XKK10006076602",
  "hos_version": "20.4.0",
  "ams_version": "1.9.4",
  "action": "Launch",        // "Launch" or "Exit"
  "title_id": "01002EF01A316000",
  "title_version": "1.0.1.3",
  "title_name": "Brotato",
  "controller_count": 2
}
```

### Field Descriptions
- `serial`: Switch console serial number (partially hidden for privacy)
- `hos_version`: Horizon OS version
- `ams_version`: Atmosphere CFW version
- `action`: Either "Launch" when game starts or "Exit" when game closes
- `title_id`: Nintendo's unique game identifier
- `title_version`: Game version number
- `title_name`: Human-readable game name
- `controller_count`: Number of controllers connected

## Setup Instructions

### For Switch Homebrew Developers

1. Configure your homebrew to send POST requests to:
   ```
   https://sipnplay.cafe/api/switch-webhook
   ```

2. Set Content-Type header to `application/json`

3. Send the webhook payload when:
   - Game launches (action: "Launch")
   - Game exits (action: "Exit")

### For Local Testing

1. **Start the test webhook receiver:**
   ```bash
   python test_webhook_receiver.py
   ```
   This creates a local webhook receiver at `http://192.168.x.x:8080/webhook`

2. **Test with the simulator:**
   ```bash
   python test_switch_webhook.py
   ```
   This sends test events to your local Next.js server

3. **Configure Switch for local testing:**
   Use `http://[YOUR_IP]:3000/api/switch-webhook` where [YOUR_IP] is your computer's local IP address

## File Structure

```
app/
├── api/
│   ├── switch-webhook/           # Webhook endpoint
│   │   └── route.ts
│   └── switch-notifications/     # SSE endpoint
│       └── route.ts
├── switch-webhook-config/        # Configuration page
│   └── page.tsx
└── layout.tsx                    # Includes SwitchGameToast

components/
└── features/
    └── switch/
        └── SwitchGameToast.tsx   # Toast notification component

lib/
└── services/
    └── switch-notifier.ts        # Notification broadcaster service

scripts/
├── test_webhook_receiver.py      # Python webhook receiver for testing
├── test_switch_webhook.py        # Webhook simulator
└── test_send_webhook.py          # Webhook test sender
```

## API Endpoints

### POST `/api/switch-webhook`
Receives webhook from Nintendo Switch

**Request Body:**
```json
{
  "action": "Launch",
  "title_name": "Mario Kart 8 Deluxe",
  "title_id": "0100152000022000",
  "controller_count": 2
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Notification sent",
  "clients": 5  // Number of connected clients notified
}
```

### GET `/api/switch-notifications`
Server-Sent Events endpoint for real-time notifications

**Event Format:**
```javascript
data: {
  "type": "switch_game",
  "action": "started",  // or "finished"
  "game": {
    "name": "Mario Kart 8 Deluxe",
    "titleId": "0100152000022000",
    "image": "https://..."  // If found in database
  },
  "player": {
    "serial": "XKK***",  // Partially hidden
    "controllerCount": 2
  },
  "timestamp": "2025-11-10T12:00:00.000Z"
}
```

## Configuration

### Environment Variables
No additional environment variables required. The system uses existing database connections.

### Admin Access
The configuration page at `/switch-webhook-config` is only accessible to admin users. It's linked in the Staff Menu for admin accounts.

## Game Image Matching

The system attempts to match game names from the Switch with games in the video games database to show thumbnails:

1. Exact name match (case-insensitive)
2. Partial name match (game name contains or is contained in database name)
3. Falls back to generic game icon if no match found

## Security Considerations

1. **Serial Number Privacy**: Only first 3 characters of console serial are shown
2. **No Authentication Required**: Webhook endpoint is public by design for Switch compatibility
3. **Rate Limiting**: Consider implementing rate limiting if abuse occurs
4. **Input Validation**: All webhook data is validated before broadcasting

## Testing

### Manual Testing
1. Open website in multiple browser tabs
2. Navigate to `/switch-webhook-config` (admin only)
3. Click "Send Test Notification" button
4. Verify toast appears in all tabs simultaneously

### Automated Testing
```bash
# Send a launch event
curl -X POST https://sipnplay.cafe/api/switch-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "Launch",
    "title_name": "Test Game",
    "title_id": "0100000000000000",
    "controller_count": 1
  }'
```

## HTTP Bridge Solution for SSL Issues

Since Nintendo Switch homebrew has problems with HTTPS/SSL certificates, we've created an HTTP-to-HTTPS bridge that solves this issue.

### Quick Solutions

#### Option 1: Free Cloudflare Tunnel (Recommended for Testing)

1. **Download cloudflared:**
   - Windows: https://github.com/cloudflare/cloudflared/releases
   - Extract and run from command line

2. **Run the tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **Use the HTTP URL provided:**
   - Cloudflare gives you: `http://quick-name-here.trycloudflare.com`
   - Configure Switch: `http://quick-name-here.trycloudflare.com/api/switch-webhook`

#### Option 2: Deploy HTTP Bridge on Railway

We've included an HTTP bridge server in `/switch-webhook-bridge/` that:
- Accepts HTTP webhooks from Switch
- Forwards them to HTTPS production site
- Handles all SSL/TLS issues

**Deploy steps:**
1. Deploy the bridge folder as a separate Railway service
2. Get HTTP URL from Railway (e.g., `http://switch-bridge.railway.app`)
3. Configure Switch to use: `http://switch-bridge.railway.app/webhook`

#### Option 3: Ngrok (For Local Testing)

```bash
# Install ngrok from https://ngrok.com
ngrok http 3000

# Use the HTTP URL provided
# Configure Switch: http://abc123.ngrok.io/api/switch-webhook
```

### HTTP Bridge Architecture

```
Nintendo Switch --[HTTP]--> Bridge/Tunnel --[HTTPS]--> sipnplay.cafe
                                 ↓
                          (Handles SSL/TLS)
```

The bridge server in `/switch-webhook-bridge/`:
- Runs on port 3001
- Accepts HTTP POST to `/webhook`
- Forwards to `https://sipnplay.cafe/api/switch-webhook`
- Returns response to Switch

## Troubleshooting

### SSL/HTTPS Issues
If your Switch can't connect due to SSL errors:
1. Use the HTTP bridge solution above
2. Make sure URL starts with `http://` not `https://`
3. Consider using Cloudflare Tunnel for easiest setup

### Notifications Not Appearing
1. Check browser console for SSE connection errors
2. Verify `/api/switch-notifications` endpoint is accessible
3. Check if browser supports Server-Sent Events

### Webhook Not Received
1. Verify webhook URL is exactly: `https://sipnplay.cafe/api/switch-webhook`
2. Check Switch has internet connection
3. Verify POST request includes `Content-Type: application/json` header
4. Check server logs for webhook receipt

### Image Not Showing
1. Game name might not match database entry
2. Check video games database has screenshot URLs
3. Verify image URLs are accessible

## Browser Compatibility

- ✅ Chrome/Edge 89+
- ✅ Firefox 87+
- ✅ Safari 14+
- ⚠️ Older browsers may not support Server-Sent Events

## Performance Considerations

- SSE connections are lightweight and efficient
- Each connection uses minimal server resources
- Dead connections are automatically cleaned up
- No database queries for broadcasting (only for image lookup)

## Future Enhancements

Potential improvements for future versions:

1. **User Preferences**
   - Allow users to disable notifications
   - Notification position customization
   - Sound effects toggle

2. **Enhanced Features**
   - Play duration tracking
   - Most played games statistics
   - Player identification (optional)
   - Game session history

3. **Integration**
   - Discord webhook forwarding
   - Analytics tracking
   - Leaderboards for play time

## Related Documentation

- [Video Games Database](./VIDEO_GAMES_DATABASE.md)
- [Railway Deployment](./RAILWAY_DEPLOYMENT.md)
- [API Endpoints](./API_ENDPOINTS.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Test with the provided Python scripts
4. Contact admin for webhook URL configuration