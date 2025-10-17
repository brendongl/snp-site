# Image Caching System

## Overview

The application now includes a local image caching system that downloads and stores game images locally, reducing load times and dependency on external image sources.

## How It Works

1. **Background Caching**: When games are fetched from Airtable for the first time, images are cached in the background
2. **On-Demand Caching**: When an image is requested but not cached, it's downloaded and cached on the fly
3. **Proxy Mode**: All images are served through `/api/images/proxy?url=...` which handles caching automatically
4. **Persistent Storage**: Images are stored in `/app/data/images/` with metadata in `/app/data/image-cache-metadata.json`

## File Structure

```
/app/data/
├── images/               # Cached image files (named by MD5 hash)
├── image-cache-metadata.json  # Metadata about cached images
├── games-cache.json      # Game data cache
└── content-checks-cache.json  # Content checks cache
```

## API Endpoints

### Get Image (with caching)
```
GET /api/images/proxy?url=<encoded-url>
```

Downloads and caches the image if not already cached, then serves it.

### Health Check (includes cache stats)
```
GET /api/health
```

Returns information about cached games and images:
```json
{
  "cache": {
    "games": {
      "count": 337,
      "lastUpdated": "2025-10-17T..."
    },
    "images": {
      "count": 150,
      "sizeMB": "45.23",
      "oldestCache": "2025-10-17T...",
      "newestCache": "2025-10-17T..."
    }
  }
}
```

## Docker Setup

The Dockerfile creates the necessary directories with proper permissions:

```dockerfile
RUN mkdir -p data data/images logs
RUN chown -R nextjs:nodejs data logs
```

### Volume Mapping (Unraid)

For persistent caching across container restarts, map the data directory:

```
Host Path: /mnt/user/appdata/snp-site/data
Container Path: /app/data
```

Make sure the host directory has proper permissions:
```bash
chmod -R 777 /mnt/user/appdata/snp-site/data
```

## Benefits

1. **Faster Load Times**: Images load from local storage instead of external sources
2. **Reduced Bandwidth**: Images are only downloaded once
3. **Reliability**: App works even if external image sources are slow or unavailable
4. **Reduced API Calls**: No repeated requests to Airtable CDN

## Cache Management

The cache is persistent across container restarts. Images are cached indefinitely with a 1-year browser cache header.

To clear the cache:
1. Stop the container
2. Delete `/mnt/user/appdata/snp-site/data/images/` and `image-cache-metadata.json`
3. Restart the container

## Technical Details

- **Hash Algorithm**: MD5 of original URL
- **Storage Format**: Original image format preserved
- **Cache Headers**: `Cache-Control: public, max-age=31536000, immutable`
- **Fallback**: If caching fails, original URL is proxied directly
- **Non-blocking**: Cache writes don't block API responses
