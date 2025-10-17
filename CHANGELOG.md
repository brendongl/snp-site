# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2025-10-17

### Fixed
- Windows file permission errors when saving image cache metadata
- Implemented fallback error handling for atomic file writes
  - Try atomic rename first (Unix/Linux)
  - Fall back to unlink + rename if that fails
  - Final fallback to direct write if all else fails
- Handles edge case where multiple processes write cache simultaneously

### Technical
- `lib/cache/image-cache.ts`: Enhanced `saveMetadata()` with multi-level fallbacks
- Prevents crashes from Windows file locking issues
- Better Windows compatibility for production deployments

## [1.0.4] - 2025-10-17

### Added
- Content-based image deduplication using MD5 hashing
  - Detects when the same image appears at different URLs
  - Reuses cached files instead of downloading duplicates
  - Reduces storage footprint and bandwidth usage
- Cache-first strategy with 1-hour TTL for games data
  - Fresh load: Returns cached games if <1 hour old
  - Stale cache: Fetches from Airtable after 1 hour
  - Fallback: Uses stale cache if Airtable API unavailable
- Hard refresh endpoint now recaches all images
  - `GET /api/games/refresh?full=true`
  - Triggers background image recaching with deduplication

### Changed
- Improved games cache TTL handling
  - `getCacheAge()`: Returns age in milliseconds
  - `isCacheOlderThan(ms)`: Checks if cache exceeds threshold

### Fixed
- Airtable image URL expiry (~12 hours)
  - Images now cached by content hash, not just URL
  - Handles URL changes gracefully

### Technical
- `lib/cache/image-cache.ts`: Added content-based deduplication
- `lib/cache/games-cache.ts`: Added TTL utilities
- `app/api/games/route.ts`: Implemented cache-first strategy
- `app/api/games/refresh/route.ts`: Added image recaching on hard refresh

## [1.0.3] - 2025-10-16

### Added
- Version display in app (v1.0.3 badge with build date)

### Fixed
- Inspector field showing Airtable record IDs instead of staff names
  - Enhanced staff mapping in `content-checker-service.ts`
  - Added debug logging for unmapped records
- Content Check History locally not displaying records
  - Switched from unreliable Airtable filterByFormula to in-memory filtering
  - Properly linked content check logs to games

### Changed
- Improved filter display in sticky header when collapsed
  - Shows visual chips for active filters
  - Displays search terms, quick filters, categories, player counts, year ranges, complexity, best player counts

## [1.0.2] - 2025-10-16

### Added
- Network error troubleshooting guide in error messages
- Better error context for API failures
- Timeout handling for Airtable requests

### Fixed
- ETIMEDOUT errors on content check loads
  - Better timeout handling for concurrent API requests
- Image loading issues from expired Airtable URLs
  - Created `/api/images/proxy` endpoint for URL proxying
  - Automatic image caching on proxy requests

### Changed
- Improved error messages for network failures
- Better user feedback on API issues

## [1.0.1] - 2025-10-15

### Added
- Project workflow documentation in `.claude/project-workflow.md`
- Version management guidelines
- Git workflow standards
- Docker build instructions

## [1.0.0] - 2025-10-15

### Added
- Image caching system
  - Local storage of game images from Airtable
  - Prevents repeated downloads of same images
  - Handles URL changes
- Docker permission fixes
  - Resolved EACCES errors in Docker container
  - Proper volume mounting for data persistence
- Initial setup and core features

### Technical
- Setup Next.js 15 project structure
- Airtable API integration
- Image caching with metadata
- Docker containerization
- GitHub Actions CI/CD

---

## Architecture Overview

### Cache Management
- **Games Cache**: Latest 337 games with 1-hour TTL
  - Location: `data/games-cache.json`
  - Strategy: Cache-first with Airtable fallback

- **Image Cache**: Board game images with content deduplication
  - Location: `data/images/` and `data/image-cache-metadata.json`
  - Strategy: MD5 content hash + URL hash mapping
  - Features: Handles URL expiry, Windows file locking

### API Endpoints
- `GET /api/games` - Get all games with caching
- `POST /api/games/refresh` - Refresh cache (incremental)
- `POST /api/games/refresh?full=true` - Hard refresh (full + image recache)
- `GET /api/images/proxy?url=...` - Proxy and cache image
- `GET /api/content-checks` - Get content check logs
- `GET /api/games/[id]` - Get specific game details

### Version Control
- Always update `lib/version.ts` and `package.json` together
- Semantic versioning: MAJOR.MINOR.PATCH
- Commit messages include version number
- Detailed changelog entries for all releases

## Future Roadmap

- [ ] Branding integration with Sip n Play logo
- [ ] Clean & Modern UI design implementation
- [ ] Advanced filter UI improvements
- [ ] Mobile app (React Native)
- [ ] User accounts and favorites
- [ ] Social features (recommendations, ratings)
