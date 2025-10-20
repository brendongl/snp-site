# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

### Build & Run Commands
```bash
npm run dev              # Start dev server (Turbopack, port 3000+)
npm run build            # Build for production
npm run start            # Run production build
npm run migrate:content-checks  # One-time migration for content checks
```

### Before Any Git Push
✅ **ALWAYS:**
1. Update version in `lib/version.ts` AND `package.json`
2. Run `npm run build` to verify no errors
3. Use the commit template below
4. Push to GitHub

### Version Numbering
- **MAJOR.MINOR.PATCH** (semantic versioning)
- Update BOTH `lib/version.ts` and `package.json` together
- Example: `1.0.5`

### Git Commit Template
```bash
git add .
git commit -m "vX.Y.Z - Feature description

Brief description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Project Structure

```
snp-site/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── games/               # Games data endpoints
│   │   ├── images/              # Image caching
│   │   ├── content-checks/      # Content check logs
│   │   └── ...
│   ├── games/                   # Games page
│   └── page.tsx                 # Home page
├── components/                   # React components
│   └── features/                # Feature-specific components
├── lib/                         # Utility libraries
│   ├── cache/                   # Cache management
│   │   ├── games-cache.ts
│   │   └── image-cache.ts
│   ├── airtable/                # Airtable API integration
│   └── version.ts               # Version constant (UPDATE THIS!)
├── .claude/                     # Claude Code settings
│   └── project-workflow.md      # Detailed workflow guide
├── package.json                 # Dependencies (UPDATE VERSION!)
└── Dockerfile                   # Docker configuration
```

## Core Architecture

### Data Flow (Simplified)
```
Browser Request (/games)
    ↓
GamesPageContent (Client Component)
    ↓
Fetch /api/games (cache-first)
    ↓
Games Cache (1-hour TTL)
    ├─ If fresh → Return cached games
    ├─ If stale → Fetch from Airtable + Update cache
    └─ If error → Return cached data (even if stale)
    ↓
GamesService (Airtable Integration)
    ↓
Filter/Sort/Render (Client-side)
```

### Three Caching Layers

#### 1. **Games Cache** (1-hour TTL)
- **File:** `data/games-cache.json`
- **Pattern:** Cache-first with Airtable fallback
- **Endpoints:**
  - `GET /api/games` - Returns cached games with metadata
  - `POST /api/games/refresh` - Incremental refresh
  - `POST /api/games/refresh?full=true` - Hard refresh (recaches images)
- **Graceful Degradation:** Returns stale cache on network errors

#### 2. **Image Cache** (Content-based deduplication)
- **Location:** `data/images/` (files) + `data/image-cache-metadata.json` (metadata)
- **Strategy:** Hashes image bytes (MD5) to detect duplicates
- **Benefits:** Reduces storage when same image appears in multiple records
- **Fallback:** Handles Airtable URL expiry (~12 hours) by fetching fresh URLs
- **Windows Safe:** Atomic writes with fallback strategies prevent corruption

#### 3. **Browser Cache**
- **Images:** 1 year (Cache-Control: immutable)
- **API responses:** No cache header (always fresh)

### Airtable Integration
- **Source:** Airtable API (Board Games base)
- **Service:** [lib/airtable/games-service.ts](lib/airtable/games-service.ts)
- **Key Methods:**
  - `getAllGames()` - Full refresh
  - `getUpdatedGames(since)` - Incremental (since timestamp)
  - `filterGames()` - Client-side filtering logic
  - `sortGames()` - Client-side sorting logic
- **Fields Used:** Game Name, Categories, Images, Year Released, Complexity, Player counts, Latest Check Date, Expansion status

### Staff Mode
- **Detection:** URL parameter `?staff=true`
- **Hook:** [lib/hooks/useStaffMode.ts](lib/hooks/useStaffMode.ts)
- **Features:**
  - Add Game dialog
  - Hard Refresh button
  - Staff-only sort options (Last Checked, Total Checks)
  - Check status badges on game cards

### Filtering & Sorting (Client-Side)
- **Filters:** Search, categories, year range, player count, complexity, quick filters
- **Sort Options:** Alphabetical, year, max players, complexity, date acquired, last checked (staff), total checks (staff)
- **Implementation:** All filtering/sorting happens in browser after fetching games
- **Special Logic:** Expansions hidden from main list but shown in parent game details

## Common Development Tasks

### Adding a New Filter
1. Define in [types/index.ts](types/index.ts) - `GameFilters` interface
2. Add filter logic in [app/games/page.tsx](app/games/page.tsx) - `useCallback` for filtering
3. Add UI component in [components/features/games/GameFilters.tsx](components/features/games/)
4. Test with various game combinations

### Adding a New Sort Option
1. Add to sort options in [app/games/page.tsx](app/games/page.tsx)
2. Implement sort logic in [lib/airtable/games-service.ts](lib/airtable/games-service.ts) - `sortGames()` method
3. Add UI option to sort dropdown in games page

### Extending Staff Features
1. Check for `useStaffMode()` in component to gate feature
2. Wrap staff-only UI in conditional render
3. Add staff-only API endpoint if needed
4. Test by visiting `/games?staff=true`

### Debugging Cache Issues
```bash
# View overall health (cache status, Airtable connectivity, environment)
curl http://localhost:3000/api/health

# View recent logs (last 50 entries)
curl http://localhost:3000/api/debug/logs

# Manual cache refresh (incremental)
curl -X POST http://localhost:3000/api/games/refresh

# Manual cache refresh (hard - recaches images)
curl -X POST http://localhost:3000/api/games/refresh?full=true
```

### Updating Airtable Field Mapping
1. Add/update field in Airtable
2. Update [types/index.ts](types/index.ts) - BoardGame or ContentCheck interface
3. Update [lib/airtable/games-service.ts](lib/airtable/games-service.ts) - field references
4. If new filter needed, follow "Adding a New Filter" steps above

### Deploying to Railway
After pushing to GitHub:
1. GitHub Actions automatically builds Docker image
2. Push to `ghcr.io/brendongl/snp-site:latest`
3. Railway detects new image and auto-deploys
4. See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed setup

**Manual Deploy (if needed):**
- Force redeploy via Railway dashboard: Settings → Restart
- Or make a new commit and push to trigger rebuild

## Key Files Reference

| File | Purpose | When to Update |
|------|---------|---|
| [lib/version.ts](lib/version.ts) | Version constant shown in app | Every release |
| [package.json](package.json) | Package version (must match lib/version.ts) | Every release |
| [lib/airtable/games-service.ts](lib/airtable/games-service.ts) | Airtable API integration | Change field names or fetch logic |
| [lib/cache/games-cache.ts](lib/cache/games-cache.ts) | Games cache TTL and logic | Adjust caching strategy |
| [lib/cache/image-cache.ts](lib/cache/image-cache.ts) | Image deduplication | Change hash algorithm or expiry |
| [types/index.ts](types/index.ts) | Type definitions | Add new Airtable fields |
| [app/games/page.tsx](app/games/page.tsx) | Main UI and filtering/sorting | Add filters, sort options, or features |
| [Dockerfile](Dockerfile) | Container configuration | Change dependencies or setup |
| [.env.local](.env.local) | Local environment (not committed) | Set API keys for development |

## API Endpoints Reference

### Games Management
- `GET /api/games` - Fetch all games (cache-first strategy)
- `GET /api/games/[id]` - Fetch single game by ID
- `GET /api/games/random` - Get random game from collection
- `POST /api/games/refresh` - Incremental refresh (incremental sync from Airtable)
- `POST /api/games/refresh?full=true` - Hard refresh (full sync + recache images)

### Image Serving
- `GET /api/images/[hash]` - Serve cached image by hash
- `GET /api/images/proxy?url=...` - Direct proxy with auto-caching (fallback)

### Content Checks
- `GET /api/content-checks` - Fetch all content checks with staff name mapping
- `POST /api/content-checks/refresh` - Refresh content check cache
- `GET /api/games/content-check?gameId=...` - Get checks for specific game

### Diagnostics
- `GET /api/health` - Full health check (DNS, Airtable connectivity, cache stats, env validation)
- `GET /api/debug/logs` - Recent application logs (last 50 entries)

## Deployment Workflow

1. **Local Development**
   - `npm run dev` (runs on localhost:3000+)
   - Make changes and test
   - `npm run build` to verify no errors

2. **Version & Commit**
   - Update `lib/version.ts` and `package.json`
   - Commit with version in message
   - Use the template above

3. **Push to GitHub**
   - `git push origin main`
   - GitHub Actions automatically builds Docker image
   - Image pushed to `ghcr.io/brendongl/snp-site:latest`

4. **Deploy to Railway**
   - Railway watches your repo for changes
   - Auto-deploys on GitHub push
   - Visit `https://sipnplay.cafe` to see live changes
   - See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for setup details

## Architecture Notes

### Caching Strategy (v1.0.4+)
- **Games**: Cache with 1-hour TTL, falls back to Airtable after expiry
- **Images**: Content-based deduplication prevents duplicate downloads
- **Resilience**: Graceful fallbacks for failed API calls

### Error Handling
- Windows file permission issues handled with fallback writes
- Airtable API timeouts use cached data
- Image load failures don't crash the app

### Key Dependencies
- Next.js 15.5 (Turbopack)
- React 18+
- Airtable API (board game data)
- Docker (deployment)

## Error Handling & Resilience

### Multi-Level Fallback Pattern
The application uses a graceful degradation strategy:
```
Request for /api/games:
  1. Check if games cache is fresh (< 1 hour old)
     ✓ Return cached data → Done

  2. If stale, fetch from Airtable
     ✓ Success → Update cache + return data
     ✗ Error → Return cached data (even if stale)
     ✗ No cache → Return error as last resort
```

### Network Resilience Features
- **Timeouts:** 30-second default (configurable)
- **IPv4 Forcing:** For Docker environments with DNS issues
- **Airtable 410 Errors:** Attempts to fetch fresh URLs when image links expire
- **File System Failures:** Fallback write strategies prevent crash on permission errors

### Error Logging
- **Logger:** [lib/logger.ts](lib/logger.ts) - Enhanced logging with file persistence
- **Log Storage:** `data/logs/` (persisted) + in-memory buffer (1000 entries)
- **Log Levels:** info, warn, error, debug, api
- **View Logs:** `GET /api/debug/logs` endpoint

## Troubleshooting

### Build Fails
```bash
# Clean and rebuild
rm -rf .next
npm run build
```

### Dev Server Won't Start
```bash
# Kill old processes and restart
npm run dev
# Server will use next available port (3000, 3001, 3002, etc.)
```

### Image Caching Issues
- Check `data/image-cache-metadata.json` integrity
- If corrupted, delete file and hard-refresh will rebuild it
- Windows: Fallback error handling attempts multiple write strategies

## Custom Hooks & Utilities

### useStaffMode
- **Location:** [lib/hooks/useStaffMode.ts](lib/hooks/useStaffMode.ts)
- **Purpose:** Detect `?staff=true` URL parameter
- **Returns:** Boolean indicating staff mode is active
- **Used in:** GameDetailModal, GameCard, GameFilters components

### useCachedImageUrl
- **Location:** [lib/cache/use-cached-image.ts](lib/cache/use-cached-image.ts)
- **Purpose:** Transform image URL to `/api/images/[hash]` for cached serving
- **Generates:** MD5 hash of original URL
- **Client-side only:** No server dependency

### createFetchWithTimeout
- **Location:** [lib/fetch-config.ts](lib/fetch-config.ts)
- **Purpose:** Fetch with timeout + IPv4 forcing
- **Timeout:** 30 seconds (configurable)
- **Use Case:** Docker environments with network issues

### Logger Singleton
- **Location:** [lib/logger.ts](lib/logger.ts)
- **Features:**
  - Console output with emoji prefixes
  - File persistence to `data/logs/`
  - In-memory buffer (last 1000 entries)
  - Methods: `info()`, `warn()`, `error()`, `debug()`, `api()`

## Settings & Configuration

### Environment Variables
**Required for Airtable:**
```
AIRTABLE_API_KEY=<your-api-key>
```

**Optional (uses hardcoded defaults if not set):**
```
AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID=viwRxfowOlqk8LkAd
```

**NextAuth (minimal setup):**
```
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://your-domain.com
```

See `.claude/settings.local.json` for Claude Code extension preferences.

## Documentation & Project Hygiene

### Documentation Guidelines

**Root Documentation (Only 3 files):**
- `README.md` - Project overview (what is this?)
- `CLAUDE.md` - Development workflow (this file)
- `CHANGELOG.md` - Version history

**Detailed Documentation** → `/docs/` directory only:
- Architecture guides, feature docs, setup instructions, troubleshooting
- Never create detailed docs in root directory

**Never Commit:**
- Session notes (CATEGORIES_FIX_SUMMARY.md, SESSION_SUMMARY.md, STATUS.md)
- Status updates or temporary summaries
- Test screenshots or artifacts
- .env files or secrets

### File Lifecycle & Naming

| What | Where | How |
|------|-------|-----|
| New feature work | Feature branch + PR | Describe in PR body, not separate file |
| Session summary | PR description | Summarize work, delete temp notes |
| Status update | Git commit messages | Don't create STATUS.md |
| Bug fix notes | Code comments | Not a FIX_SUMMARY.md file |
| Test screenshots | .gitignore | Never commit to version control |
| Deprecated docs | Git history | Archive via tags, delete from root |

### Rules to Prevent Mess

1. **One Purpose Per File** - Don't mix concerns
2. **No Session Notes in Root** - Archive to git history via commits
3. **No Duplicate Documentation** - One file per topic
4. **Max 3 Top-Level .md Files** - README, CLAUDE, CHANGELOG only
5. **Keep Detailed Docs in `/docs/`** - Separate from root
6. **Test Artifacts to .gitignore** - Never version control screenshots/logs
7. **No Status Updates** - Use git commits and PR descriptions instead

### When Adding Documentation

Ask yourself:
- "Does this file already exist for this topic?" → If yes, update it
- "Will this be outdated in 2 weeks?" → If yes, put in code comment, not separate file
- "Is this a session note?" → If yes, summarize in PR, don't commit
- "Is this root-level or docs/-level?" → Most detailed docs go in `/docs/`

### Documentation Structure

```
✅ GOOD: Few files, clear organization
README.md              ← GitHub landing page
CLAUDE.md             ← Dev guide (this file)
CHANGELOG.md          ← Version history

docs/
├── DEPLOYMENT.md              ← Infrastructure setup
├── TROUBLESHOOTING.md        ← Common issues & fixes
├── DOCKER.md                 ← Build process reference
├── AIRTABLE_SCHEMA.md       ← Database schema
└── [feature docs...]          ← Feature-specific documentation

❌ AVOID: Many files in root
CATEGORIES_FIX_SUMMARY.md     ← One-time task, delete after done
SESSION_SUMMARY.md             ← Session notes, delete after commit
STATUS.md                      ← Status updates, use git commits instead
MIGRATION_SUMMARY.md           ← Historical info, archive to git
```

### Workflow Examples

**Adding a Feature:**
```
1. Create feature branch: git checkout -b feature/my-feature
2. Implement feature and commit regularly
3. Create Pull Request with description (not a FEATURE_SUMMARY.md)
4. Summarize work in PR body
5. Merge PR
6. If docs need updating, edit docs/* files
7. Never leave FEATURE_SUMMARY.md or SESSION_SUMMARY.md behind
```

**Fixing a Bug:**
```
1. Add code comments explaining the fix
2. Commit with descriptive message
3. Update docs/TROUBLESHOOTING.md if applicable
4. Don't create FIX_SUMMARY.md or BUG_NOTES.md
```

**Major Migration:**
```
1. Work in dedicated branch
2. Commit with clear messages
3. On merge, git tags the commit (archives to history)
4. Delete temporary notes/summaries
5. Update DEPLOYMENT.md or relevant docs
6. Never leave MIGRATION_SUMMARY.md in root
```

---

**Last Updated**: October 20, 2025
**Current Version**: 1.2.0
**Hosting**: Railway → Cloudflare
**Domain**: https://sipnplay.cafe

## Architecture Notes

### Separation of Concerns
- **Services** ([lib/airtable/](lib/airtable/)) - Airtable API integration
- **Cache** ([lib/cache/](lib/cache/)) - File persistence and deduplication
- **API Routes** ([app/api/](app/api/)) - Request handling and caching coordination
- **Components** ([components/](components/)) - UI rendering and user interaction
- **Hooks** ([lib/hooks/](lib/hooks/)) - Reusable client-side logic

### Key Patterns
1. **Cache-First:** Always check local cache before fetching from Airtable
2. **Graceful Degradation:** Errors never crash the app; fallbacks keep service running
3. **Content Deduplication:** Image hashing prevents duplicate storage
4. **Non-Blocking Background Tasks:** Image caching doesn't block API responses
5. **Atomic Writes:** File operations use temp file + rename to prevent corruption
