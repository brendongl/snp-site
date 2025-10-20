# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Deployment Strategy
**As of v1.3.0**, this project uses a two-branch deployment model:
- **`staging` branch** - Testing environment (Railway auto-deploys)
- **`main` branch** - Production environment → sipnplay.cafe (Railway auto-deploys)

**All changes (minor/major) go to `staging` first** for testing. Changes are merged to `main` only after user confirmation via "push to main".

## [1.3.5] - 2025-10-20

### Fixed
- **Authentication Using PostgreSQL Cache**: Staging now uses cached staff data instead of Airtable API
  - `POST /api/staff/verify-email` now queries PostgreSQL `staff_list` table
  - Fixes "fetch failed" errors on staging environment
  - Eliminates Airtable API timeout issues during login
  - Staff data must be synced to PostgreSQL via `scripts/sync-staff-to-staging.js` (47 staff members)
  - Requires `DATABASE_URL` environment variable set on Railway

### Prerequisites
- PostgreSQL `staff_list` table created via `scripts/create-staff-table.js`
- Staff members synced from Airtable to PostgreSQL (completed in previous deployment)
- `DATABASE_URL` configured on Railway staging environment

### Performance
- Login now queries local PostgreSQL cache instead of Airtable API
- Faster response times for staff authentication
- More reliable on staging with reduced network dependency

## [1.3.4] - 2025-10-20

### Fixed
- **Play Logs API Base ID Correction**: Play Logs table is in SNP Games List base, not Sip N Play base
  - GET /api/play-logs: Now queries correct base (AIRTABLE_GAMES_BASE_ID)
  - POST /api/play-logs: Creates records in correct base
  - DELETE /api/play-logs: Deletes from correct base
  - PATCH /api/play-logs: Updates records in correct base
  - Error "Record ID does not exist" now resolved by using correct base

- **Play Logs Staff Linking Architecture**: Implemented proper multi-base record linking
  - Staff authentication uses Staff table (Sip N Play base)
  - Play Logs "Logged By" links to StaffList table (SNP Games List base)
  - Reason: Airtable cannot link records between different bases
  - `/api/staff/verify-email` now returns both staffId and staffListRecordId
  - Client stores both: `staff_id` (Sip N Play) and `staff_record_id` (SNP Games List)

- **Response Body Reading Error**: Fixed "body stream already read" error in PlayLogDialog
  - Response body can only be read once in Fetch API
  - Now read as text first, then parse JSON for proper error handling

- **Type Safety**: Fixed Next.js 15 route handler params Promise type
  - app/api/games/[id]/edit/route.ts: Updated params type to Promise<{ id: string }>

- **TypeScript Compilation**: Fixed type errors in EditGameDialog.tsx
  - Proper type assertions for parseInt() operations

- **StaffLoginDialog Record ID**: Now correctly stores StaffList record ID
  - Was storing Sip N Play Staff table ID (wrong for Play Logs linking)
  - Now stores StaffList table ID for proper Play Logs linking

### Technical
- Enhanced `app/api/staff/verify-email/route.ts`:
  - Queries Staff table (Sip N Play) for authentication
  - Also queries StaffList table (SNP Games List) to get matching record ID
  - Returns both IDs for different purposes
- Updated `app/auth/signin/page.tsx`:
  - Stores staff_id (Staff table) and staff_record_id (StaffList table)
- Updated `components/features/staff/StaffLoginDialog.tsx`:
  - Stores correct staffListRecordId for Play Logs linking
- Updated `docs/AIRTABLE_SCHEMA.md`:
  - Added critical architecture note: Staff vs StaffList table usage
  - Documented when to use each table for different operations
  - Added complete StaffList table reference

### Documentation
- **CRITICAL NOTE**: Updated schema documentation explaining why StaffList table exists
  - Staff table (Sip N Play): Used for authentication, Type field checking
  - StaffList table (SNP Games List): Used for linked records within SNP Games List base
  - This is a workaround for Airtable's inability to link records between bases

## [1.3.3] - 2025-10-20

### Fixed
- **Admin Detection in StaffLoginDialog**: Fixed critical bug where admin users showed as staff
  - StaffLoginDialog was missing localStorage.setItem for staff_type
  - Both signin page and dialog now correctly store staff_type field

## [1.3.2] - 2025-10-20

### Fixed
- **Staff Table Base Reference**: Changed staff verification to use correct Sip N Play base
  - Was querying games base for staff table (wrong)
  - Now queries Sip N Play base for staff authentication (correct)

## [1.3.1] - 2025-10-20

### Fixed
- **Next.js 15 Dynamic Rendering**: Added force-dynamic to signin page
  - Prevents static prerendering that conflicts with useSearchParams()

## [1.3.0] - 2025-10-20

### Added
- **Play Log System** - Staff can log when games are played
  - 📊 Floating button overlay on game cards (staff-only, mobile-friendly)
  - Play Log dialog with Session Date/Time (defaults to now) and optional Notes
  - Duplicate detection: Blocks if any staff logged same game within 1 hour
  - Toast notifications showing "Successfully logged [Game Name]" on /games page
  - PostgreSQL caching for fast duplicate detection
  - Automatic cache cleanup for play logs older than 1 hour
  - Graceful fallback if PostgreSQL check fails (still creates in Airtable)

- **Staff Game Knowledge System** - Track and share game knowledge
  - "Add Knowledge" button in game detail modal (staff-only)
  - Dialog with fields: Confidence Level, Was Taught By (dropdown), Notes
  - Confidence Levels: Beginner, Intermediate, Expert, Instructor
  - Confirmation popup for Expert/Instructor levels: "you must be able to teach this game!"
  - Staff Game Knowledge page with filters:
    - Filter by Game Name (new)
    - Filter by Staff Member
    - Filter by Confidence Level
    - Sort by Staff (default) or Sort by Level (new - replaces "All Levels" filter)
  - Table displays: Game, Staff Member, Confidence Level, Was Taught By, Can Teach, Notes
  - "Was Taught By" now linked record dropdown (populated from Staff table)

- **Staff List Caching** - PostgreSQL cache for Airtable staff members
  - `staff_list` table in PostgreSQL synced daily from Airtable
  - Fast dropdown population (no Airtable API call per dialog open)
  - `/api/staff-list/sync` endpoint for manual or scheduled syncing
  - GitHub Actions workflow for daily cron job at 2 AM UTC

- **Toast Notification System** - Global toast notifications
  - `ToastProvider` context for managing notifications
  - `ToastContainer` component with auto-dismiss (default 3 seconds)
  - Success/Error/Info toast types with appropriate icons
  - Fixed bottom-right positioning, dismissible via X button
  - Integrated with play log success messages

- **GitHub Actions Automation**
  - Daily staff list sync workflow (`.github/workflows/sync-staff-daily.yml`)
  - Runs at 2 AM UTC to refresh staff cache from Airtable
  - Manual trigger available via `workflow_dispatch`

### Changed
- Enhanced event propagation handling in dialogs
  - PlayLogDialog and AddGameKnowledgeDialog prevent unintended closes
  - Confirmation dialogs properly layer over main dialogs
- Staff Game Knowledge table layout adjusted for new "Was Taught By" column
- Play log time calculation now uses PostgreSQL (`EXTRACT(EPOCH)`) instead of JavaScript for accuracy

### Fixed
- Mobile click handling on radio buttons in dialogs (removed hover tooltips)
- Dialog closing unexpectedly after confirming Expert/Instructor level
- Staff mode detection now checks localStorage first, then URL param
- Sticky header and staff menu positioning issues
- Play log time calculations showing incorrect minutes ago (420 minutes bug)

### Technical
- Created `lib/db/postgres.ts` functions:
  - `checkRecentPlayLog()` - Check for duplicates within 1 hour
  - `cachePlayLog()` - Cache play log in PostgreSQL
  - `cleanupOldPlayLogs()` - Remove logs older than 1 hour
  - `getStaffList()` - Query cached staff members
  - `syncStaffListFromAirtable()` - Sync staff from Airtable to PostgreSQL
- Created `/api/staff-list/route.ts` - GET endpoint for cached staff
- Created `/api/staff-list/sync/route.ts` - POST endpoint for manual sync
- Created `/api/play-logs/route.ts` - GET (existing), POST (new for logging)
- Created `/api/staff/verify-email/route.ts` - Validate staff email against Airtable
- Created `components/features/staff/PlayLogDialog.tsx` - Play log creation UI
- Created `components/features/staff/AddGameKnowledgeDialog.tsx` - Knowledge entry UI
- Created `lib/context/toast-context.tsx` - Global toast state management
- Created `components/ui/toast-container.tsx` - Toast display component
- Updated `GameDetailModal.tsx` - Added "Add Knowledge" button and dialog integration
- Updated `GameCard.tsx` - Added 📊 floating button and PlayLogDialog integration
- Updated `app/staff/knowledge/page.tsx` - Added Game Name filter, Sort by Level option, Was Taught By column
- Updated `lib/hooks/useStaffMode.ts` - Check localStorage before URL param
- Updated `app/layout.tsx` - Wrapped with ToastProvider, added ToastContainer
- Updated `next.config.ts` - Removed incompatible serverComponentsExternalPackages config
- Added `scripts/create-staff-table.js` - Node script to initialize PostgreSQL table

### Database
- PostgreSQL tables created:
  - `play_log_cache` - Caches recent play logs with 1-hour implicit TTL
  - `staff_list` - Caches all staff members from Airtable Staff table
  - Both have proper indexes and comments for documentation

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
