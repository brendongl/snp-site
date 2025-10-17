# Docker Deployment Guide

## Quick Start

### Using Docker Compose

1. Copy `.env.example` to `.env` and fill in your Airtable credentials:
```bash
cp .env.example .env
```

2. Edit `.env` with your values:
```bash
AIRTABLE_API_KEY=key_xxxxxxxxxxxxx
AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID=viwHMUIuvp0H2S1vE
```

3. Build and run:
```bash
docker-compose up -d
```

4. Access the application at `http://localhost:3000`

### Using Docker CLI

```bash
docker build -t sipnplay-portal .

docker run -d \
  --name sipnplay-portal \
  -p 3000:3000 \
  -e AIRTABLE_API_KEY=your_key \
  -e AIRTABLE_GAMES_BASE_ID=your_base_id \
  -e AIRTABLE_GAMES_TABLE_ID=your_table_id \
  -e AIRTABLE_GAMES_VIEW_ID=your_view_id \
  sipnplay-portal
```

## Unraid Setup

### Method 1: Docker Compose (Recommended)

1. Install "Docker Compose Manager" plugin from Community Applications
2. Create a new stack with the `docker-compose.yml` from this repo
3. Add environment variables in the Unraid UI
4. Deploy the stack

### Method 2: Manual Docker Container

1. Go to Docker tab in Unraid
2. Click "Add Container"
3. Fill in the following:

**Container Settings:**
- Name: `sipnplay-portal`
- Repository: `your-registry/sipnplay-portal:latest` (after pushing to registry)
- Port: `3000` -> `3000`

**Environment Variables (Required):**
```
AIRTABLE_API_KEY=key_xxxxxxxxxxxxx
AIRTABLE_CUSTOMER_BASE_ID=appoZWe34JHo21N1z
AIRTABLE_CUSTOMER_TABLE_ID=tblfat1kxUvaNnfaQ
AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID=viwHMUIuvp0H2S1vE
```

**Environment Variables (Optional):**
```
NEXTAUTH_URL=http://your-server:3000
NEXTAUTH_SECRET=generate-with-openssl
DISCORD_WEBHOOK_URL=your-webhook-url
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_PAGE_ID=your-page-id
FACEBOOK_ACCESS_TOKEN=your-token
N8N_WEBHOOK_URL=your-n8n-webhook
N8N_API_KEY=your-n8n-key
GOOGLE_MAPS_API_KEY=your-maps-key
REDIS_URL=redis://your-redis:6379
```

4. Click "Apply"

### Redis Setup (Optional but Recommended)

For better performance, deploy Redis:

1. Add another container: `redis:7-alpine`
2. Name: `sipnplay-redis`
3. Port: `6379` -> `6379`
4. Volume: `/mnt/user/appdata/sipnplay-redis` -> `/data`
5. Command: `redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru`

Then update the web container's `REDIS_URL` to: `redis://sipnplay-redis:6379`

## Environment Variables Reference

### Required Variables
- `AIRTABLE_API_KEY` - Your Airtable API key
- `AIRTABLE_GAMES_BASE_ID` - Games Airtable base ID
- `AIRTABLE_GAMES_TABLE_ID` - Games table ID
- `AIRTABLE_GAMES_VIEW_ID` - Games view ID (optional if you want all records)

### Optional Variables
- `AIRTABLE_CUSTOMER_BASE_ID` - Customer base ID (if using customer features)
- `AIRTABLE_CUSTOMER_TABLE_ID` - Customer table ID
- `AIRTABLE_EVENTS_TABLE_ID` - Events table ID
- `NEXTAUTH_URL` - Full URL of your deployment (e.g., http://192.168.1.100:3000)
- `NEXTAUTH_SECRET` - Secret for authentication (generate with `openssl rand -base64 32`)
- `REDIS_URL` - Redis connection URL (defaults to redis://redis-cache:6379)
- `DISCORD_WEBHOOK_URL` - Discord webhook for notifications
- `FACEBOOK_*` - Facebook integration credentials
- `N8N_*` - n8n integration credentials
- `GOOGLE_MAPS_API_KEY` - Google Maps API key

## Building for Production

To build and push to a registry:

```bash
# Build
docker build -t your-registry/sipnplay-portal:0.2.0 .
docker build -t your-registry/sipnplay-portal:latest .

# Push
docker push your-registry/sipnplay-portal:0.2.0
docker push your-registry/sipnplay-portal:latest
```

## Health Checks

The container includes health checks:
- Web: `http://localhost:3000/api/health`
- Redis: `redis-cli ping`

Monitor container health:
```bash
docker ps
docker inspect sipnplay-portal | grep Health -A 10
```

## Logs

View logs:
```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f sipnplay-web

# Last 100 lines
docker logs --tail 100 sipnplay-portal
```

## Troubleshooting

### Container won't start
1. Check logs: `docker logs sipnplay-portal`
2. Verify environment variables are set
3. Ensure Airtable credentials are valid

### Redis connection issues
1. Check Redis is running: `docker ps | grep redis`
2. Verify network connectivity: `docker network ls`
3. Check REDIS_URL format: `redis://host:6379`

### Port already in use
Change the host port in docker-compose.yml:
```yaml
ports:
  - "3001:3000"  # Change 3001 to any available port
```

## Performance Tuning

### Redis Memory
Adjust Redis memory limit in docker-compose.yml:
```yaml
command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
```

### Container Resources
Add resource limits:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```
