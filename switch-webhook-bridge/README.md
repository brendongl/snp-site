# Switch Webhook HTTP Bridge

This bridge solves the SSL certificate issues that Nintendo Switch homebrew has with HTTPS endpoints. It accepts HTTP webhooks and forwards them to the HTTPS production site.

## The Problem

Nintendo Switch homebrew applications often have issues with:
- SSL certificate validation
- HTTPS connections
- Modern TLS versions

This causes webhooks to fail when sent directly to `https://sipnplay.cafe/api/switch-webhook`.

## Solution Options

### Option 1: Deploy HTTP Bridge on Railway (Recommended)

Deploy this bridge as a separate Railway service that accepts HTTP and forwards to HTTPS.

#### Deployment Steps:

1. **Create a new Railway service:**
   ```bash
   cd switch-webhook-bridge
   railway init
   railway link
   railway up
   ```

2. **Set environment variables in Railway:**
   ```
   FORWARD_TO_URL=https://sipnplay.cafe/api/switch-webhook
   PORT=3001
   ```

3. **Get your HTTP URL from Railway:**
   - Railway will provide a URL like: `http://switch-bridge.railway.app`
   - Configure your Switch to use: `http://switch-bridge.railway.app/webhook`

### Option 2: Use a Subdomain with HTTP

If you control the domain, you can set up a subdomain that accepts HTTP:

1. Create subdomain: `http://switch-webhook.sipnplay.cafe`
2. Point it to this bridge service
3. Configure Switch to use the HTTP subdomain

### Option 3: Use Ngrok (For Testing)

For quick testing without deployment:

1. **Install ngrok:**
   ```bash
   # Download from https://ngrok.com/download
   ```

2. **Run the bridge locally:**
   ```bash
   cd switch-webhook-bridge
   npm install
   npm start
   ```

3. **Create ngrok tunnel:**
   ```bash
   ngrok http 3001
   ```

4. **Use ngrok URL:**
   - Ngrok provides: `http://abc123.ngrok.io`
   - Configure Switch: `http://abc123.ngrok.io/webhook`

### Option 4: Use Cloudflare Tunnel (Free Permanent Solution)

Cloudflare Tunnel can provide a permanent HTTP endpoint:

1. **Install cloudflared:**
   ```bash
   # Download from https://github.com/cloudflare/cloudflared/releases
   ```

2. **Run the bridge:**
   ```bash
   cd switch-webhook-bridge
   npm install
   npm start
   ```

3. **Create tunnel:**
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```

4. **Get permanent URL:**
   - Cloudflare provides a URL like: `http://quick-example-name.trycloudflare.com`
   - This URL changes each time unless you set up a permanent tunnel

### Option 5: Direct HTTP Service (Simplest)

Deploy a modified version of your webhook directly on HTTP:

1. Create a separate HTTP-only deployment
2. Modify your Next.js app to accept HTTP on a different port
3. Use environment variable to disable HTTPS redirect

## Running the Bridge Locally

```bash
# Install dependencies
npm install

# Run the bridge
npm start

# The bridge will be available at:
# http://localhost:3001/webhook

# Test it:
curl -X POST http://localhost:3001/test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port to listen on | 3001 |
| `FORWARD_TO_URL` | HTTPS endpoint to forward to | https://sipnplay.cafe/api/switch-webhook |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | * |
| `IGNORE_SSL` | Ignore SSL errors (dev only) | false |

## How It Works

1. **Switch sends HTTP webhook** to bridge
2. **Bridge receives** and validates the payload
3. **Bridge forwards** to HTTPS production endpoint
4. **Bridge returns** response to Switch

```
Nintendo Switch --[HTTP]--> Bridge Server --[HTTPS]--> sipnplay.cafe
                               ↓
                        (Handles SSL/TLS)
```

## API Endpoints

### `GET /`
Health check endpoint

### `POST /webhook`
Main webhook endpoint - receives HTTP webhooks from Switch

### `POST /test`
Sends a test webhook through the bridge

### `GET /stats`
Server statistics

## Testing

Test the bridge is working:

```bash
# Test with curl
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "Launch",
    "title_name": "Test Game",
    "title_id": "0100000000000000",
    "controller_count": 1
  }'

# Use the test endpoint
curl -X POST http://localhost:3001/test
```

## Docker Deployment

```bash
# Build image
docker build -t switch-webhook-bridge .

# Run container
docker run -p 3001:3001 \
  -e FORWARD_TO_URL=https://sipnplay.cafe/api/switch-webhook \
  switch-webhook-bridge
```

## Railway Deployment

The easiest production deployment:

1. Push to GitHub
2. Connect Railway to your repo
3. Select the `switch-webhook-bridge` directory
4. Railway auto-deploys with Dockerfile
5. Get your HTTP URL from Railway dashboard

## Monitoring

The bridge logs all webhook activity:

```
[2025-11-10T12:00:00.000Z] POST /webhook from 192.168.1.100
Body: {
  "action": "Launch",
  "title_name": "Mario Kart 8 Deluxe",
  ...
}
[FORWARD] Sending to https://sipnplay.cafe/api/switch-webhook
[FORWARD] Success: 200 - Notified 5 clients
```

## Security Notes

- The bridge is designed to be public (no authentication)
- It only forwards to the configured HTTPS endpoint
- Request validation ensures required fields are present
- IP addresses are forwarded in headers for logging

## Troubleshooting

### "Connection refused"
- Check the bridge is running
- Verify the port is correct
- Check firewall settings

### "502 Bad Gateway"
- The HTTPS endpoint is not responding
- Check FORWARD_TO_URL is correct
- Verify production site is running

### "SSL Error" still appearing
- Make sure Switch is using HTTP (not HTTPS)
- URL should be `http://` not `https://`

## Alternative: Disable SSL in Switch Homebrew

If possible, you can modify the Switch homebrew to:
- Disable SSL certificate verification
- Use older TLS versions
- Skip certificate validation

However, the HTTP bridge is usually easier and more reliable.