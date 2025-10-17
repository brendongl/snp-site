# Discord Version Notifications

This document describes how to set up and use Discord webhook notifications for version releases.

## Overview

When you push a new version to the main branch, an automated notification is sent to Discord with:
- Version number
- Build date
- List of recent changes/commits
- Link to the commit on GitHub

## Setup

### 1. Create a Discord Webhook

1. Go to your Discord server
2. Open Server Settings → Integrations → Webhooks
3. Click "New Webhook"
4. Name it "Sip n Play Bot"
5. Copy the webhook URL

### 2. Set Environment Variables

**Local Development:**
```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN"
```

**GitHub Actions (recommended):**
1. Go to your GitHub repository Settings
2. Click Secrets and Variables → Actions
3. Create a new secret: `DISCORD_WEBHOOK_URL`
4. Paste your webhook URL

**Environment Files:**
Add to `.env.local` (never commit):
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
DISCORD_WEBHOOK_TOKEN=dev-token  # Optional: for API endpoint auth
```

## Usage

### Automatic (GitHub Actions)

The workflow automatically triggers when you:
1. Push a commit to `main` that modifies `lib/version.ts` or `package.json`
2. The workflow extracts the version and sends a Discord notification

**To trigger:**
```bash
# Update version in both files
npm version patch  # or minor/major

# Push to main
git push origin main
```

The workflow will automatically:
- Detect the new version
- Extract recent commits
- Send formatted notification to Discord

### Manual Command Line

Use the provided script:

```bash
# Using auto-detected version from package.json
DISCORD_WEBHOOK_URL="your-webhook-url" node scripts/notify-discord.js --auto

# Or specify version and changes manually
DISCORD_WEBHOOK_URL="your-webhook-url" node scripts/notify-discord.js 1.0.6 \
  "Fixed expansion display bug" \
  "Added Discord notifications" \
  "Improved performance"
```

### Programmatic (API Endpoint)

Send a POST request to `/api/discord/notify-version`:

```bash
curl -X POST http://localhost:3000/api/discord/notify-version \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "version": "1.0.6",
    "buildDate": "2025-10-17",
    "changes": [
      "Fixed expansion display bug",
      "Added Discord notifications"
    ]
  }'
```

**Note:** The API endpoint requires `Authorization: Bearer $DISCORD_WEBHOOK_TOKEN` header.

## Message Format

Discord notifications include:
- **Embed Title:** "🎮 New Version Released"
- **Description:** Version number and app name
- **Fields:**
  - Version (v1.0.6)
  - Build Date (YYYY-MM-DD)
  - Updates (bullet points of changes)
  - Repository Link (to the specific commit)

Example:
```
🎮 New Version Released
Board Games Portal has been updated to v1.0.6

📦 Version: v1.0.6
📅 Build Date: 2025-10-17
🔗 Repository: [View on GitHub](link-to-commit)
```

## Troubleshooting

### Webhook URL not set
**Error:** `DISCORD_WEBHOOK_URL environment variable not set`

**Solution:**
```bash
export DISCORD_WEBHOOK_URL="your-webhook-url"
# Then run the script
```

### 401 Unauthorized (API Endpoint)
**Error:** Discord API returns 401

**Cause:** Missing or incorrect authorization header

**Solution:**
- Verify the webhook URL is correct
- Ensure `Authorization: Bearer <token>` header is present
- Check `DISCORD_WEBHOOK_TOKEN` environment variable

### 404 Not Found (Webhook)
**Error:** Discord API returns 404

**Cause:** Invalid webhook URL

**Solution:**
1. Generate a new webhook in Discord server
2. Update the webhook URL in GitHub secrets or environment variables
3. Test with `curl` first to verify

### Network timeout
**Cause:** Docker or firewall blocking outbound HTTPS

**Solution:**
- Check Docker network configuration
- Ensure HTTPS (port 443) is not blocked
- Try using a different Discord webhook endpoint

## Testing

### Test the Endpoint Locally
```bash
# Start dev server
npm run dev

# In another terminal
curl -X POST http://localhost:3000/api/discord/notify-version \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "version": "1.0.6",
    "buildDate": "2025-10-17",
    "changes": ["Test message"]
  }'
```

### Test the Script
```bash
DISCORD_WEBHOOK_URL="your-webhook-url" node scripts/notify-discord.js 1.0.6 "Test"
```

### Manual Webhook Test
```bash
curl -X POST "your-webhook-url" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "🎮 Test notification"
  }'
```

## File Reference

- **API Route:** `app/api/discord/notify-version/route.ts`
- **Utility:** `lib/discord/webhook.ts`
- **Script:** `scripts/notify-discord.js`
- **Workflow:** `.github/workflows/notify-version.yml`

## Next Steps

1. Add webhook URL to GitHub repository secrets
2. Test workflow by pushing a version bump to main
3. Verify notification appears in Discord
4. Customize message format as needed in `lib/discord/webhook.ts`

---

**Last Updated:** October 17, 2025
