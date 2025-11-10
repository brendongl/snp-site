# Quick Setup: Cloudflare Tunnel for Nintendo Switch Webhook

## Why This is Needed
Nintendo Switch homebrew has issues with HTTPS/SSL certificates. This guide shows how to use Cloudflare Tunnel to create an HTTP endpoint that forwards to your HTTPS production site.

## Quick Start (5 minutes)

### Step 1: Download cloudflared
Download the appropriate version for your system:
- **Windows**: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
- **Mac**: `brew install cloudflare/tap/cloudflared`
- **Linux**: `wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb`

### Step 2: Run the Tunnel

For production (sipnplay.cafe):
```bash
cloudflared tunnel --url https://sipnplay.cafe
```

For local testing:
```bash
cloudflared tunnel --url http://localhost:3000
```

### Step 3: Configure Your Switch
Cloudflare will give you a URL like:
```
https://quick-random-name.trycloudflare.com
```

**IMPORTANT**: Use the HTTP version (not HTTPS) for your Switch:
```
http://quick-random-name.trycloudflare.com/api/switch-webhook
```

## That's It! 🎮

Your Switch can now send webhooks via HTTP, and Cloudflare handles the SSL/HTTPS conversion automatically.

## Testing

Test your webhook with curl:
```bash
curl -X POST http://your-tunnel-name.trycloudflare.com/api/switch-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "Launch",
    "title_name": "Test Game",
    "title_id": "0100000000000000",
    "controller_count": 1,
    "serial": "XKK123456",
    "hos_version": "20.0.0",
    "ams_version": "1.9.0"
  }'
```

## Architecture
```
Nintendo Switch --[HTTP]--> Cloudflare Tunnel --[HTTPS]--> sipnplay.cafe
                                    ↓
                            (Handles all SSL/TLS)
```

## Notes
- The tunnel URL changes each time you restart cloudflared (unless you create an account)
- For a permanent tunnel, sign up for a free Cloudflare account
- The tunnel works from anywhere - no port forwarding needed
- This is perfect for testing and can also be used in production