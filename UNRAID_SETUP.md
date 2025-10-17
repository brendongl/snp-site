# Unraid Setup Guide for Sip N' Play Portal

This guide will help you deploy the Sip N' Play Portal on Unraid using Docker with automatic updates from GitHub.

## Prerequisites

1. GitHub account
2. Unraid server with Docker enabled
3. Your Airtable credentials

## Step 1: GitHub Actions Setup (Automatic Docker Builds)

The repository is already configured with GitHub Actions (`.github/workflows/docker-build.yml`). Every time you push to the `main` branch, it will automatically:
- Build a Docker image
- Push it to GitHub Container Registry (ghcr.io)
- Tag it as `latest` and with the version number

After pushing your code:
1. Go to your repo → Actions tab
2. Wait for the workflow to complete (first build takes ~5 minutes)
3. Go to your repo → Packages (or click your profile → Packages)
4. You should see `snp-site` package
5. Click it → Package settings → Change visibility to **Private** if needed

## Step 2: Create GitHub Personal Access Token (for Unraid to pull private images)

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Note: `Unraid Docker Pull`
4. Expiration: No expiration (or set to 1 year)
5. Select scopes:
   - ✓ `read:packages` (to download packages)
6. Click "Generate token"
7. **COPY AND SAVE THIS TOKEN** - you won't see it again!

## Step 3: Install on Unraid

### Option A: Using Unraid Docker UI (Recommended)

1. Open Unraid Web UI → Docker tab
2. Click "Add Container"
3. Fill in these fields:

**Basic Settings:**
- Name: `sipnplay-portal`
- Repository: `ghcr.io/brendongl/snp-site:latest`
- Registry URL: `https://ghcr.io`
- Username: `brendongl` (your GitHub username)
- Password: Your GitHub Personal Access Token (from Step 2)

**Network Type:**
- Network Type: `Bridge`
- Port Mapping:
  - Container Port: `3000`
  - Host Port: `3000` (or choose another port like `3001`)

**Environment Variables:**
Add these variables (click "Add another Path, Port, Variable, Label or Device" for each):

**Required:**
1. Variable:
   - Name: `AIRTABLE_API_KEY`
   - Key: `AIRTABLE_API_KEY`
   - Value: `key_xxxxxxxxxxxxx`

2. Variable:
   - Name: `AIRTABLE_GAMES_BASE_ID`
   - Key: `AIRTABLE_GAMES_BASE_ID`
   - Value: `apppFvSDh2JBc0qAu`

3. Variable:
   - Name: `AIRTABLE_GAMES_TABLE_ID`
   - Key: `AIRTABLE_GAMES_TABLE_ID`
   - Value: `tblIuIJN5q3W6oXNr`

4. Variable:
   - Name: `AIRTABLE_GAMES_VIEW_ID`
   - Key: `AIRTABLE_GAMES_VIEW_ID`
   - Value: `viwHMUIuvp0H2S1vE`

**Optional (add if needed):**
5. Variable:
   - Name: `AIRTABLE_CUSTOMER_BASE_ID`
   - Key: `AIRTABLE_CUSTOMER_BASE_ID`
   - Value: `appoZWe34JHo21N1z`

6. Variable:
   - Name: `AIRTABLE_CUSTOMER_TABLE_ID`
   - Key: `AIRTABLE_CUSTOMER_TABLE_ID`
   - Value: `tblfat1kxUvaNnfaQ`

7. Variable:
   - Name: `REDIS_URL`
   - Key: `REDIS_URL`
   - Value: `redis://sipnplay-redis:6379` (if using Redis container)

4. Click "Apply"

### Option B: Using Docker Compose

1. SSH into Unraid
2. Create directory:
```bash
mkdir -p /mnt/user/appdata/sipnplay-portal
cd /mnt/user/appdata/sipnplay-portal
```

3. Create `.env` file:
```bash
nano .env
```

Add your credentials:
```env
AIRTABLE_API_KEY=key_xxxxxxxxxxxxx
AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID=viwHMUIuvp0H2S1vE
```
Save (Ctrl+X, Y, Enter)

4. Create `docker-compose.yml`:
```bash
nano docker-compose.yml
```

Add:
```yaml
version: '3.8'

services:
  sipnplay-web:
    image: ghcr.io/brendongl/snp-site:latest
    container_name: sipnplay-portal
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - AIRTABLE_API_KEY=${AIRTABLE_API_KEY}
      - AIRTABLE_GAMES_BASE_ID=${AIRTABLE_GAMES_BASE_ID}
      - AIRTABLE_GAMES_TABLE_ID=${AIRTABLE_GAMES_TABLE_ID}
      - AIRTABLE_GAMES_VIEW_ID=${AIRTABLE_GAMES_VIEW_ID}
      - REDIS_URL=redis://redis-cache:6379
    depends_on:
      - redis-cache

  redis-cache:
    image: redis:7-alpine
    container_name: sipnplay-redis
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: unless-stopped

volumes:
  redis-data:
```
Save (Ctrl+X, Y, Enter)

5. Login to GitHub Container Registry:
```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u brendongl --password-stdin
```

6. Start containers:
```bash
docker-compose up -d
```

### Step 4: Access Your Application

Open browser: `http://YOUR-UNRAID-IP:3000`

## Manual Docker Container Setup (Alternative)

If you prefer not to use Docker Compose:

### 1. Create Redis Container

1. Go to Docker tab in Unraid
2. Click "Add Container"
3. Settings:
   - Name: `sipnplay-redis`
   - Repository: `redis:7-alpine`
   - Network Type: Custom - `br0` or `bridge`
   - Port: `6379` -> `6379`
   - Add Path: `/mnt/user/appdata/sipnplay-redis` -> `/data`
   - Add Variable: `--appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru` (in Extra Parameters)

### 2. Build and Create Web Container

First, build the image on your Unraid terminal:

```bash
cd /mnt/user/appdata/sipnplay-portal
docker build -t sipnplay-portal:0.2.0 .
docker tag sipnplay-portal:0.2.0 sipnplay-portal:latest
```

Then create the container:

1. Go to Docker tab
2. Click "Add Container"
3. Settings:
   - Name: `sipnplay-portal`
   - Repository: `sipnplay-portal:latest`
   - Network Type: Custom - `br0` or `bridge`
   - Port: `3000` -> `3000`

4. Add Environment Variables (click "Add another Path, Port, Variable, Label or Device"):

**Required:**
```
Name: AIRTABLE_API_KEY          Value: key_xxxxxxxxxxxxx
Name: AIRTABLE_GAMES_BASE_ID    Value: apppFvSDh2JBc0qAu
Name: AIRTABLE_GAMES_TABLE_ID   Value: tblIuIJN5q3W6oXNr
Name: AIRTABLE_GAMES_VIEW_ID    Value: viwHMUIuvp0H2S1vE
```

**Optional (for additional features):**
```
Name: REDIS_URL                 Value: redis://sipnplay-redis:6379
Name: NEXTAUTH_URL              Value: http://your-server:3000
Name: NEXTAUTH_SECRET           Value: generate-with-openssl
Name: DISCORD_WEBHOOK_URL       Value: your-webhook-url
```

5. Click "Apply"

## Updating the App

### Method 1: Automatic Updates with Watchtower (Easiest)

Install Watchtower container to auto-check for updates:

1. Unraid → Docker → Add Container
2. Name: `watchtower`
3. Repository: `containrrr/watchtower`
4. Add Variable:
   - Key: `WATCHTOWER_POLL_INTERVAL`
   - Value: `3600` (checks every hour)
5. Apply

Watchtower will automatically pull new images when you push to GitHub!

### Method 2: Manual Update via Unraid GUI

1. Make changes in your local code
2. Commit and push to GitHub:
```bash
git add .
git commit -m "Update: description of changes"
git push
```
3. Wait ~5 minutes for GitHub Actions to build new image
4. In Unraid Docker tab:
   - Click `sipnplay-portal` container
   - Click "Update Container"
   - Toggle "Update image"
   - Click "Apply"

### Method 3: Via SSH

```bash
docker pull ghcr.io/brendongl/snp-site:latest
docker restart sipnplay-portal
```

## Version Tags

You can use specific version tags:
- `latest` - Always the latest build from main branch
- `v0.2.0` - Specific version
- `main` - Latest from main branch (same as latest)

To use a specific version in Unraid:
- Change Repository to: `ghcr.io/brendongl/snp-site:v0.2.0`

## Port Configuration

If port 3000 is already in use, you can change it:

**In docker-compose.yml:**
```yaml
ports:
  - "8080:3000"  # Change 8080 to your preferred port
```

**Or in Unraid Docker UI:**
- Change Host Port from `3000` to your preferred port (e.g., `8080`)
- Keep Container Port as `3000`

## Troubleshooting

### Check Container Logs

**Docker Compose:**
```bash
docker-compose logs -f sipnplay-web
```

**Docker:**
```bash
docker logs sipnplay-portal
```

### Verify Environment Variables

```bash
docker exec sipnplay-portal env | grep AIRTABLE
```

### Check Redis Connection

```bash
docker exec sipnplay-redis redis-cli ping
# Should return: PONG
```

### Restart Everything

```bash
docker-compose restart
# or
docker restart sipnplay-portal sipnplay-redis
```

## Backup

To backup your setup:

```bash
# Backup Redis data
cp -r /mnt/user/appdata/sipnplay-redis /mnt/user/backups/

# Backup configuration
cp /mnt/user/appdata/sipnplay-portal/.env /mnt/user/backups/
```

## Performance Tips

1. **Allocate more memory to Redis** if you have many games:
   ```yaml
   command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
   ```

2. **Use SSD for appdata** if possible - significantly improves Docker performance

3. **Set CPU pinning** in Unraid Docker settings for better performance

## Support

- GitHub Issues: https://github.com/brendongl/snp-site/issues
- Docker Logs: Check for errors in container logs
- Airtable Status: Verify your API key and base IDs are correct

## Version Information

Current Version: **v0.2.0**
Build Date: 2025-01-17

Check for updates:
```bash
cd /mnt/user/appdata/sipnplay-portal
git fetch
git log HEAD..origin/main --oneline
```
