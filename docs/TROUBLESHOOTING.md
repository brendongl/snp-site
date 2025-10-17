# Troubleshooting Guide

## Network Timeout Errors (ETIMEDOUT)

### Symptoms
- "Failed to load content check history"
- "Network timeout - Cannot reach Airtable API"
- Games page fails to load with `fetch failed` error
- Health endpoint shows unhealthy status

### Root Cause
Docker container cannot reach `api.airtable.com` due to network configuration issues.

### Solutions

#### Solution 1: Use Host Network Mode ⭐ (Recommended)

**For Unraid:**
1. Go to Docker tab
2. Click on your container, select "Edit"
3. Change **Network Type** from `Bridge` to `Host`
4. Click "Apply"
5. Container will restart automatically

**Pros:**
- Container uses host's network stack directly
- Best performance
- Easiest solution

**Cons:**
- Port conflicts if multiple containers use same ports

---

#### Solution 2: Add DNS Servers

**For Unraid:**
1. Go to Docker tab
2. Click on your container, select "Edit"
3. In **Extra Parameters** field, add:
   ```
   --dns 8.8.8.8 --dns 8.8.4.4
   ```
4. Click "Apply"

**Pros:**
- Keeps bridge network mode
- Fixes DNS resolution issues

**Cons:**
- May not fix all network issues

---

#### Solution 3: Check Network Connectivity

**Test from Unraid terminal:**
```bash
# Enter the container
docker exec -it snp-site sh

# Test DNS resolution
nslookup api.airtable.com

# Test HTTP connectivity
wget -O- https://api.airtable.com

# Exit container
exit
```

**If DNS fails:**
- Use Solution 2 (add DNS servers)

**If HTTP fails but DNS works:**
- Check firewall rules
- Check proxy settings
- Try Solution 1 (host network mode)

---

#### Solution 4: Use Custom Bridge Network

**Create custom bridge network:**
```bash
docker network create --driver bridge snp-network
```

**Run container with custom network:**
```bash
docker run -d \
  --name snp-site \
  --network snp-network \
  --dns 8.8.8.8 \
  [other options] \
  snp-site
```

---

## Permission Errors

### Symptoms
- `EACCES: permission denied, mkdir '/app/logs'`
- `EACCES: permission denied, open '/app/data/games-cache.json'`

### Solution 1: Fix Host Volume Permissions

**For Unraid:**
```bash
# Find where you mapped /app/data
# Usually something like /mnt/user/appdata/snp-site/data

chmod -R 777 /mnt/user/appdata/snp-site/data
```

### Solution 2: Run as Root (Less Secure)

**In Docker template, Extra Parameters:**
```
--user 0:0
```

### Solution 3: Map Volumes with Proper Permissions

**In Unraid Docker template:**
- Add container path: `/app/data`
- Add host path: `/mnt/user/appdata/snp-site/data`
- Mode: Read/Write

---

## Image Caching Issues

### Images not loading

**Check cache status:**
Visit `http://your-server:3000/api/health` and look for:
```json
{
  "cache": {
    "images": {
      "count": 0,
      "sizeMB": "0.00"
    }
  }
}
```

**If count is 0:**
- Images haven't been cached yet
- Check network connectivity (same as above)
- Clear games cache to trigger re-fetch and caching

**Clear caches:**
```bash
docker exec -it snp-site sh
rm /app/data/games-cache.json
rm /app/data/image-cache-metadata.json
rm -rf /app/data/images/*
exit
```

Then restart container or visit `/api/games` to trigger fresh fetch.

---

## Build Errors

### TypeScript errors during build

**Run local build:**
```bash
npm run build
```

**Common fixes:**
- Update dependencies: `npm install`
- Clear Next.js cache: `rm -rf .next`
- Check for syntax errors in modified files

---

## Airtable API Issues

### Invalid API Key

**Symptoms:**
- "AIRTABLE_API_KEY is not set"
- HTTP 401 Unauthorized

**Solution:**
Check environment variables in Docker template:
```
AIRTABLE_API_KEY=your_actual_key_here
AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
```

### Rate Limiting

**Symptoms:**
- HTTP 429 Too Many Requests
- Slow responses

**Solution:**
- Use the cache system (already implemented)
- Reduce refresh frequency
- Wait for rate limit to reset

---

## Performance Issues

### Slow page loads

**Check cache:**
Visit `/api/health` to see if caches are populated.

**If caches are empty:**
- Wait for initial cache population
- Check network connectivity

**If caches are full:**
- Check server resources (CPU, RAM, disk)
- Check Docker resource limits

### High memory usage

**Reduce cache size:**
Edit `lib/cache/games-cache.ts` and `lib/cache/image-cache.ts` to limit cache entries.

---

## Getting Help

### Collect Diagnostic Information

1. **Check health endpoint:**
   ```bash
   curl http://your-server:3000/api/health | jq
   ```

2. **Check container logs:**
   ```bash
   docker logs snp-site --tail 100
   ```

3. **Test network from inside container:**
   ```bash
   docker exec -it snp-site sh
   wget -O- https://api.airtable.com
   ```

4. **Check Docker network:**
   ```bash
   docker network inspect bridge
   ```

### Report Issue

Include:
- Error message from UI
- Container logs
- Health endpoint output
- Network test results
- Docker configuration (network mode, DNS, etc.)

GitHub Issues: https://github.com/brendongl/snp-site/issues
