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

- `1.0.0` - Image caching system, Docker permission fixes
- `0.9.0` - Content check history, staff mode
- `0.8.0` - Games catalog with filters
- `0.1.0` - Initial setup

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

## Notes

- Keep commits atomic and focused
- Always include version in commit message
- Document breaking changes clearly
- Test in Docker before deploying to production
