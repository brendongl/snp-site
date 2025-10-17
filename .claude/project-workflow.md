# SNP Site - Project Workflow Guidelines

## Version Management & Git Workflow

### For Every Significant Change

1. **Update Version Number** in [package.json](../package.json)
   - Use semantic versioning: `MAJOR.MINOR.PATCH`
   - **MAJOR**: Breaking changes or major features
   - **MINOR**: New features, additions
   - **PATCH**: Bug fixes, small improvements

2. **Commit Changes**
   ```bash
   git add -A
   git commit -m "vX.Y.Z - Brief description

   Features:
   - Feature 1
   - Feature 2

   Fixes:
   - Fix 1
   - Fix 2

   Technical:
   - Technical detail 1

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

3. **Push to GitHub**
   ```bash
   git push
   ```

4. **Include Version in Summary**
   Always mention the version number in the final summary message to the user.

### Example Version History

- `1.0.5` - Windows file permission fixes for image cache metadata
- `1.0.4` - Content-based image deduplication and cache-first strategy with TTL
- `1.0.3` - Fix version display and show staff names in content checks
- `1.0.2` - Improve network error messages and add troubleshooting guide
- `1.0.1` - Add project workflow documentation
- `1.0.0` - Image caching system, Docker permission fixes

## Docker Build Workflow

After pushing to GitHub, users can rebuild the Docker image:

```bash
# On Unraid or Docker host
docker pull ghcr.io/brendongl/snp-site:latest
# or
cd /path/to/repo && git pull && docker build -t snp-site .
```

## Key Files to Remember

- [package.json](../package.json) - Version number
- [Dockerfile](../Dockerfile) - Docker configuration
- [docs/](../docs/) - All documentation
- [.env.local](../.env.local) - Local environment variables (not committed)

## Development Guidelines

1. **Always test build** before committing:
   ```bash
   npm run build
   ```

2. **Use non-breaking changes** when possible
   - Graceful error handling
   - Fallback behavior
   - Optional features

3. **Document major changes** in [docs/](../docs/)

4. **Update health endpoint** for new features that affect system status

## Common Tasks

### Adding a New API Route
1. Create file in `app/api/[route]/route.ts`
2. Add error handling with timeouts
3. Test with `npm run build`
4. Update version, commit, push

### Adding a New Feature
1. Implement feature
2. Update relevant documentation
3. Test build
4. Update version (MINOR bump)
5. Commit with detailed message
6. Push to GitHub

### Bug Fix
1. Fix the bug
2. Test build
3. Update version (PATCH bump)
4. Commit with fix description
5. Push to GitHub

## Deployment

After pushing to GitHub, Watchtower (if configured) will:
1. Detect new image
2. Pull latest image
3. Restart container automatically

Otherwise, manually rebuild:
```bash
docker build -t snp-site .
docker stop snp-site
docker rm snp-site
docker run -d --name snp-site [options] snp-site
```

## Current Architecture Notes

### Caching Strategy (as of v1.0.4+)
- **Games Cache**: 1-hour TTL, cache-first approach
  - Fresh load: Returns cached games if <1 hour old
  - Stale cache: Fetches from Airtable after 1 hour
  - Fallback: Uses stale cache if Airtable API unavailable

- **Image Caching**: Content-based deduplication (MD5 hash)
  - Detects duplicate images across different URLs
  - Reuses cached files instead of downloading duplicates
  - Windows-compatible fallback error handling
  - Files: `lib/cache/image-cache.ts`, `lib/cache/games-cache.ts`

### File Locations
- **Version tracking**: [lib/version.ts](../lib/version.ts)
- **Cache utilities**: [lib/cache/](../lib/cache/)
- **API routes**: [app/api/](../app/api/)
- **Component library**: [components/](../components/)

## Notes

- Keep commits atomic and focused
- Always include version in commit message
- Document breaking changes clearly
- Test in Docker before deploying to production
- Update both `lib/version.ts` AND `package.json` version numbers in sync
- For image/cache issues: Check Windows file permissions first, fallback error handling is in place
