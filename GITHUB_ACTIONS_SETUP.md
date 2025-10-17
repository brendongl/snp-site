# GitHub Actions Setup - Quick Reference

## What Just Happened

🎉 Your repository now has automatic Docker builds set up using GitHub Actions!

## How It Works

1. **You push code** to the `main` branch
2. **GitHub Actions triggers** automatically (`.github/workflows/docker-build.yml`)
3. **Builds Docker image** using your Dockerfile
4. **Pushes to GitHub Container Registry** at `ghcr.io/brendongl/snp-site`
5. **Tags the image** with:
   - `latest` (always the newest)
   - `v0.2.0` (if you pushed a tag)
   - `main` (branch name)
   - SHA (commit hash)
6. **Sends Discord notification** (if DISCORD_WEBHOOK_URL secret is set)

## First Time Setup

### Step 1: Wait for First Build

After pushing, go to:
- https://github.com/brendongl/snp-site/actions

You should see the workflow running. Wait ~5 minutes for it to complete.

### Step 2: Verify Package Was Created

Go to:
- https://github.com/brendongl?tab=packages
- Or: https://github.com/brendongl/snp-site/pkgs/container/snp-site

You should see the `snp-site` package. Click on it.

### Step 3: Set Package Visibility

If the package is public and you want it private:
1. Click the package
2. Click "Package settings" (bottom right)
3. Under "Danger Zone" → Change visibility → Private
4. Confirm

## Using in Unraid

### Create GitHub Personal Access Token

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Name: `Unraid Docker Pull`
4. Expiration: No expiration (or 1 year)
5. Scopes: ✓ `read:packages`
6. Generate token
7. **SAVE THIS TOKEN!**

### Add Container in Unraid

1. Docker tab → Add Container
2. Settings:
   - Name: `sipnplay-portal`
   - Repository: `ghcr.io/brendongl/snp-site:latest`
   - Registry URL: `https://ghcr.io`
   - Username: `brendongl`
   - Password: [Your Personal Access Token]
   - Port: `3000` → `3000`

3. Add environment variables:
   - `AIRTABLE_API_KEY`
   - `AIRTABLE_GAMES_BASE_ID`
   - `AIRTABLE_GAMES_TABLE_ID`
   - `AIRTABLE_GAMES_VIEW_ID`

4. Apply

## Automatic Updates

### Install Watchtower

1. Unraid → Docker → Add Container
2. Name: `watchtower`
3. Repository: `containrrr/watchtower`
4. Variable:
   - Key: `WATCHTOWER_POLL_INTERVAL`
   - Value: `3600` (checks every hour)
5. Apply

Now when you push code, GitHub builds it, and Watchtower updates your container automatically!

## Manual Update

If you don't use Watchtower:

1. Push your code
2. Wait for GitHub Actions to finish
3. In Unraid Docker tab:
   - Click container
   - Update Container
   - Toggle "Update image"
   - Apply

## Version Tags

To deploy a specific version:

1. Create a tag:
```bash
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0
```

2. In Unraid, change repository to:
   - `ghcr.io/brendongl/snp-site:v0.3.0`

## Discord Notifications (Optional)

To get notified when builds complete:

1. Create a Discord webhook in your server
2. Go to GitHub repo → Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `DISCORD_WEBHOOK_URL`
5. Value: Your Discord webhook URL
6. Add secret

Now you'll get notifications on every build!

## Troubleshooting

### Workflow Failed

Go to Actions tab and click the failed workflow to see logs.

Common issues:
- Dockerfile syntax errors
- Missing dependencies in package.json
- Build timeout (increase if needed)

### Can't Pull Image in Unraid

- Verify package visibility (private requires token)
- Check token has `read:packages` scope
- Ensure username matches your GitHub username
- Try logging in via SSH: `echo "TOKEN" | docker login ghcr.io -u brendongl --password-stdin`

### Image Not Updating

- Check if GitHub Actions completed successfully
- Verify you're using `:latest` tag
- Force pull: `docker pull ghcr.io/brendongl/snp-site:latest`
- Restart container

## Current Workflow File

Located at: `.github/workflows/docker-build.yml`

Triggers on:
- Push to `main` branch
- Push tags matching `v*` (e.g., v0.2.0)

You can customize:
- Branch names
- Tag patterns
- Build options
- Notification format

## Benefits

✅ No manual Docker builds
✅ Consistent build environment
✅ Version history via tags
✅ Automatic updates via Watchtower
✅ Works with private repositories
✅ Discord notifications
✅ Secure - no need to expose Docker on Unraid

## Next Steps

1. Push code → Watch it build in Actions tab
2. Pull image in Unraid using `ghcr.io/brendongl/snp-site:latest`
3. Set up Watchtower for auto-updates
4. (Optional) Add Discord webhook for notifications
