# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: November 4, 2025
**Current Version**: 1.4.0
**Hosting**: Railway (Docker containers)
**Domain**: https://sipnplay.cafe

---

## Quick Start

### Build & Run Commands
```bash
npm run dev              # Start dev server (Turbopack, port 3000+)
npm run build            # Build for production
npm run start            # Run production build
npm run migrate:content-checks  # Migrate content checks to PostgreSQL
npm run migrate:images          # Migrate images to persistent volume
npm run download:images         # Download images from database
npm run notify:discord          # Send Discord notification
```

### Before Any Git Push
✅ **CRITICAL WORKFLOW - ALL CHANGES GO TO STAGING FIRST:**

**ALL revisions (minor or major) MUST go to the `staging` branch first for testing.** The `main` branch is production-only and is only updated when explicitly instructed with "push to main".

**Standard Deployment Workflow:**
1. Update version in [lib/version.ts](lib/version.ts) AND [package.json](package.json)
2. Run `npm run build` to verify no errors
3. Use the commit template below
4. Push to `staging` branch: `git push origin staging`
5. Test on staging environment (user will confirm via "push to main")
6. After user confirms, merge to `main`: `git push origin main`

**Important:**
- Always commit to `staging` by default
- **NEVER push to `main` unless user explicitly says "push to main"**
- Staging environment URL will be different from sipnplay.cafe (production)
- Only merge to main when ready for production deployment

### Version Numbering
- **MAJOR.MINOR.PATCH** (semantic versioning)
- Update BOTH [lib/version.ts](lib/version.ts) and [package.json](package.json) together
- Example: `1.4.7`

### Git Commit Template
```bash
git add .
git commit -m "vX.Y.Z - Feature description

Brief description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Branch Strategy
**Two-Branch Deployment Model:**
- **`staging` branch** - Testing environment for all new features/fixes
  - Railway auto-deploys from this branch
  - Used for QA before production
  - All development work commits here first
- **`main` branch** - Production environment (sipnplay.cafe)
  - Only updated after user confirms changes are ready
  - Trigger phrase: "push to main"
  - Railway auto-deploys from this branch to production

---

## Claude Code Skills & Best Practices

### Proactive Task Optimization (`proactive-task-optimizer`)

**Purpose**: Enables autonomous task continuation and systematic debugging without requiring repeated "continue" prompts.

**Use this skill when:**

**Proactive Triggers (automatic - no user request needed):**
- Encountering the same error for the 2nd time in a conversation
- About to ask "should I..." or "would you like me to..." for a straightforward next step
- A tool failed silently (no error but unexpected result)
- In the middle of a multi-step task and approaching a natural checkpoint
- Just completed a subtask and there are clear next steps
- Realize you need to read a file/context you haven't checked yet
- Workflow execution fails and there's an obvious retry strategy

**Reactive Triggers (user explicitly requests):**
- User says "keep going", "continue", or "don't stop"
- User mentions frustration with repeated errors or asking the same thing
- User asks to "just fix it" or "make it work"
- User points out you already have information you're asking about
- User requests autonomous debugging or error resolution

**Examples:**
```
❌ DON'T: "I got an error connecting to the database. Should I try again?"
✅ DO: Launch proactive-task-optimizer to systematically debug and retry multiple solutions

❌ DON'T: "I've completed the API endpoint. Would you like me to add tests?"
✅ DO: Launch proactive-task-optimizer to continue with logical next steps

❌ DON'T: Ask user about obvious file locations after 2nd failed attempt
✅ DO: Launch proactive-task-optimizer to thoroughly search for the file
```

### Quality Control Enforcement (`quality-control-enforcer`)

**Purpose**: Reviews and validates completed work to ensure it meets quality standards and avoids common pitfalls.

**Use this skill when:**
- Implementation is complete and all tests pass
- User has asked you to implement a feature
- Before merging or creating a pull request
- User suspects quality issues ("this feels hacky", "is this a proper solution?")
- After completing any significant feature or refactoring

**Examples:**
```
✅ User: "I implemented the user authentication system"
   Launch quality-control-enforcer to review implementation

✅ User: "The login is working but it feels hacky - can you check if this is proper?"
   Launch quality-control-enforcer to analyze for workarounds or shortcuts

✅ After implementing a complex feature spanning multiple files
   Launch quality-control-enforcer before committing to staging
```

**Quality Standards Enforced:**
- Security best practices (no SQL injection, XSS, command injection, etc.)
- Proper error handling and resilience patterns
- Code maintainability and readability
- No workarounds or temporary hacks
- Follows project architecture patterns (service layer, type safety, etc.)
- Proper testing coverage

---

## Core Architecture

### Database & Data Flow (v1.3.5+)

**Primary Data Source: PostgreSQL**
- Production database hosted on Railway
- 5 core tables: `games`, `game_images`, `play_logs`, `content_checks`, `staff_knowledge`
- Connection pool managed via [lib/db/postgres.ts](lib/db/postgres.ts)
- Full schema details: [docs/POSTGRESQL_MIGRATION_SUMMARY.md](docs/POSTGRESQL_MIGRATION_SUMMARY.md)

**Secondary Data Source: Airtable**
- Used for backfill operations and data verification
- Staff table sync for authentication
- Accessed via [lib/airtable/games-service.ts](lib/airtable/games-service.ts)

**Data Flow (Simplified)**
```
Browser Request (/games)
    ↓
GamesPageContent (Client Component)
    ↓
Fetch /api/games (PostgreSQL-first)
    ↓
GamesDbService (Primary)
    ↓
PostgreSQL Database (Always fresh)
    ├─ If success → Return games from database
    └─ If error → Log error and return empty/cached data
    ↓
Filter/Sort/Render (Client-side)
```

### Service Layer Architecture

All database access goes through service classes in [lib/services/](lib/services/):

| Service | Purpose | Key Methods |
|---------|---------|-------------|
| [games-db-service.ts](lib/services/games-db-service.ts) | Games data access | `getAllGames()`, `getGameById()`, `updateGame()` |
| [content-checks-db-service.ts](lib/services/content-checks-db-service.ts) | Content check history | `getChecksByGameId()`, `createCheck()` |
| [play-logs-db-service.ts](lib/services/play-logs-db-service.ts) | Game session tracking | `getLogsByGameId()`, `createLog()` |
| [staff-knowledge-db-service.ts](lib/services/staff-knowledge-db-service.ts) | Staff expertise levels | `getKnowledgeByStaffMember()`, `getTeachersForGame()` |
| [changelog-service.ts](lib/services/changelog-service.ts) | Changelog tracking | `getAllChangelogs()`, `createChangelog()` |
| [vikunja-service.ts](lib/services/vikunja-service.ts) | Vikunja task management | `getPriorityTasks()`, `getTask()`, `completeTask()` |
| [bgg-api.ts](lib/services/bgg-api.ts) | BoardGameGeek integration | `getGameDetails()`, `searchGames()` |

See [docs/DATABASE_SERVICES_USAGE.md](docs/DATABASE_SERVICES_USAGE.md) for detailed usage examples.

### Caching Strategy

**Four-Layer Caching:**

1. **PostgreSQL (Primary)** - Always-fresh data
   - No TTL, always queried first
   - Connection pool for performance

2. **Persistent Volume (Images)**
   - Location: `/app/data/images/` on Railway
   - Content-based deduplication (MD5 hashing)
   - See [docs/RAILWAY_PERSISTENT_VOLUME_SETUP.md](docs/RAILWAY_PERSISTENT_VOLUME_SETUP.md)

3. **In-Memory Cache**
   - Games data cached for quick API responses
   - Play log cache for analytics

4. **Browser Cache**
   - Images: 1 year (Cache-Control: immutable)
   - API responses: No cache header

---

## Project Structure

```
snp-site/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes (44+ endpoints)
│   │   ├── games/               # Games CRUD endpoints
│   │   ├── images/              # Image caching & serving
│   │   ├── content-checks/      # Content check logs
│   │   ├── admin/               # Admin-only operations
│   │   ├── staff/               # Staff operations
│   │   ├── play-logs/           # Play session tracking
│   │   ├── changelog/           # Changelog data
│   │   └── analytics/           # Analytics insights
│   ├── games/                   # Games catalog page
│   ├── staff/                   # Staff-only pages
│   │   ├── knowledge/           # Staff expertise management
│   │   ├── play-logs/           # Play session logs
│   │   ├── changelog/           # Changelog viewer
│   │   ├── check-history/       # Content check history
│   │   └── add-knowledge/       # Add expertise
│   └── page.tsx                 # Home page
├── components/                   # React components
│   └── features/                # Feature-specific components
├── lib/                         # Utility libraries
│   ├── services/                # Database service layer (7 files)
│   ├── db/                      # PostgreSQL connection pool
│   ├── cache/                   # Cache management
│   ├── airtable/                # Airtable API (secondary)
│   ├── hooks/                   # Custom React hooks
│   ├── storage/                 # Persistent volume management
│   ├── analytics/               # Mixpanel integration
│   ├── discord/                 # Discord webhooks
│   └── version.ts               # Version constant (UPDATE THIS!)
├── scripts/                     # Migration & utility scripts (33 files)
├── docs/                        # Detailed documentation (17 files)
├── .claude/                     # Claude Code settings
├── package.json                 # Dependencies (UPDATE VERSION!)
└── Dockerfile                   # Docker configuration
```

---

## Major Features

### Staff Mode
- **Detection**: URL parameter `?staff=true`
- **Hook**: [lib/hooks/useStaffMode.ts](lib/hooks/useStaffMode.ts)
- **Features**:
  - Add Game dialog
  - Hard Refresh button
  - Staff-only sort options (Last Checked, Total Checks)
  - Check status badges on game cards
  - Access to staff pages ([app/staff/](app/staff/))

### Admin Mode
- **Detection**: User role check via NextAuth
- **Hook**: [lib/hooks/useAdminMode.ts](lib/hooks/useAdminMode.ts)
- **Features**:
  - Storage management ([/api/admin/storage](app/api/admin/storage/route.ts))
  - Image migration ([/api/admin/migrate-images](app/api/admin/migrate-images/route.ts))
  - Airtable sync ([/api/admin/sync-to-airtable](app/api/admin/sync-to-airtable/route.ts))
  - Staging file operations ([/api/admin/staging-files](app/api/admin/staging-files/route.ts))

### Changelog System (v1.4.0+)
- **Service**: [lib/services/changelog-service.ts](lib/services/changelog-service.ts)
- **API**: [/api/changelog](app/api/changelog/route.ts), [/api/changelog/stats](app/api/changelog/stats/route.ts)
- **Page**: [app/staff/changelog/page.tsx](app/staff/changelog/page.tsx)
- **Features**: Version tracking, analytics, staff activity logs
- **Details**: [docs/CHANGELOG_IMPLEMENTATION.md](docs/CHANGELOG_IMPLEMENTATION.md)

### Play Logs System
- **Service**: [lib/services/play-logs-db-service.ts](lib/services/play-logs-db-service.ts)
- **API**: [/api/play-logs](app/api/play-logs/route.ts)
- **Page**: [app/staff/play-logs/page.tsx](app/staff/play-logs/page.tsx)
- **Features**: Session tracking, player counts, duration, staff logging

### Staff Knowledge Management
- **Service**: [lib/services/staff-knowledge-db-service.ts](lib/services/staff-knowledge-db-service.ts)
- **API**: [/api/staff-knowledge](app/api/staff-knowledge/route.ts)
- **Pages**: [app/staff/knowledge/page.tsx](app/staff/knowledge/page.tsx), [app/staff/add-knowledge/page.tsx](app/staff/add-knowledge/page.tsx)
- **Features**: Expertise tracking, confidence levels, can_teach flags

### BoardGameGeek Integration
- **Service**: [lib/services/bgg-api.ts](lib/services/bgg-api.ts)
- **API**: [/api/games/bgg/[id]](app/api/games/bgg/[id]/route.ts)
- **Features**: Game details fetch, ratings, metadata enrichment

### Analytics
- **Integration**: Mixpanel ([lib/analytics/mixpanel.ts](lib/analytics/mixpanel.ts))
- **API**: [/api/analytics/insights](app/api/analytics/insights/route.ts)
- **Features**: Page views, user tracking, event logging

### Vikunja Task Management (v1.4.0+)

**Status**: ✅ Fully implemented and tested in v1.4.1

- **Instance**: https://tasks.sipnplay.cafe (self-hosted on Railway)
- **Service**: [lib/services/vikunja-service.ts](lib/services/vikunja-service.ts)
- **API Endpoints**:
  - [/api/vikunja/tasks/priority](app/api/vikunja/tasks/priority/route.ts) - Fetch priority tasks (due within 3 days)
  - [/api/vikunja/tasks/complete](app/api/vikunja/tasks/complete/route.ts) - Complete task and award points (v1.4.1)
  - [/api/staff/points](app/api/staff/points/route.ts) - Fetch staff member's points and info (v1.4.1)
- **Dashboard**: [app/staff/dashboard/page.tsx](app/staff/dashboard/page.tsx) - "Upcoming Tasks" section

#### Database Schema (v1.4.1)
Three new columns added to `staff_list` table via [scripts/add-points-and-vikunja-columns.js](scripts/add-points-and-vikunja-columns.js):
- `points` (INTEGER, default 0) - Staff member's accumulated points
- `vikunja_user_id` (INTEGER) - Links to Vikunja user account
- `vikunja_username` (TEXT) - Vikunja username for display
- Index on `vikunja_user_id` for performance

#### Account Management
**All 13 staff members have Vikunja accounts** (created v1.4.1):
- **Creation Script**: [scripts/create-vikunja-accounts.js](scripts/create-vikunja-accounts.js)
  - Generates usernames from staff names (handles Vietnamese diacritics)
  - Creates secure random passwords (displayed once during creation)
  - Links accounts to `staff_list` via `vikunja_user_id`
  - Rate limiting: 2-second delay between registrations
- **Team Assignment**: [scripts/add-staff-to-team.js](scripts/add-staff-to-team.js)
  - All staff added to "Sip n Play" team (ID: 1)
  - Enables access to project tasks
- **Verification**: [scripts/check-staff-for-vikunja.js](scripts/check-staff-for-vikunja.js)

#### Points System Features (v1.4.1)
**Gamification workflow**:
1. **Label-based Points**: Tasks have point labels (e.g., "points:500", "points:1000")
2. **3-Day Task Visibility**: Dashboard shows tasks due within next 3 days (not just today/overdue)
3. **Three-tier Color Coding**:
   - 🔴 **Red**: Overdue tasks
   - 🟠 **Orange**: Due today
   - 🔵 **Blue**: Due soon (1-3 days)
4. **Complete Button**: Each task card has "Complete" button with loading state
5. **Points Award**: Completing task:
   - Marks task done in Vikunja via API
   - Awards points to staff member in database
   - Updates points display in real-time
   - Removes task from dashboard
6. **Header Display**: Shows logged-in staff name and points with gold star badge

**Implementation Details**:
- `extractPoints()` - Parse point value from task labels
- `isDueSoon()` - Check if task due within 3 days
- `enhanceTask()` - Add computed fields (points, isOverdue, isDueToday, isDueSoon)
- `handleCompleteTask()` - Client-side handler with optimistic updates

#### Point Label Scale
Created via [scripts/create-vikunja-point-labels.js](scripts/create-vikunja-point-labels.js):
- 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000 points
- Color-coded for quick identification
- Admin-only assignment

#### Documentation
- [docs/VIKUNJA_TASK_WORKFLOW.md](docs/VIKUNJA_TASK_WORKFLOW.md) - Complete workflow guide
- [docs/TASK_PROPOSAL_TEMPLATE.md](docs/TASK_PROPOSAL_TEMPLATE.md) - Staff task proposal format
- [docs/VIKUNJA_WORKAROUNDS.md](docs/VIKUNJA_WORKAROUNDS.md) - UI bug workarounds

#### Environment Variables Required
```bash
VIKUNJA_API_URL=https://tasks.sipnplay.cafe/api/v1
VIKUNJA_API_TOKEN=tk_e396533971cba5f0873c21900a49ecd136602c77  # Must be set in Railway
```

#### Known Issues & Workarounds
- **⚠️ UI Bug**: Vikunja v1.0.0-rc2 has greyed-out "+ Add Task" button
  - **Workaround 1**: Press `Ctrl+K` → type "new task" (fastest)
  - **Workaround 2**: Use [scripts/add-vikunja-task.js](scripts/add-vikunja-task.js) (most features)
  - See [docs/VIKUNJA_WORKAROUNDS.md](docs/VIKUNJA_WORKAROUNDS.md) for details

#### Testing Status (v1.4.1)
**All Testing Completed** ✅:
- ✅ Database schema updated
- ✅ All staff accounts created and linked
- ✅ 3-day task visibility implemented
- ✅ Dashboard UI with color coding (red/orange/blue)
- ✅ Complete button on task cards with loading states
- ✅ API endpoints for completion and points
- ✅ Real-time points display in header
- ✅ End-to-end testing on local development environment
- ✅ Task completion workflow verified (button click → API → points award → UI update)
- ✅ Points award correctly to database (tested: 0 → 200 points)
- ✅ Task removal from dashboard after completion (tested: 3 → 2 tasks)
- ✅ Vikunja API integration confirmed (task marked done successfully)

#### Future Enhancements
- Leaderboard display on dashboard
- Points history/transaction log
- Badge/achievement system
- Task completion notifications
- Weekly/monthly reports

### iPOS Integration with Playwright (v1.7.7)
**IMPORTANT UPDATE**: Successfully integrated Playwright directly into Railway for iPOS data scraping

**Key Discovery**: iPOS authentication tokens are session-bound and cannot be extracted:
- Direct API calls fail with 401 Unauthorized (even with full cookies + headers)
- Tokens only work within the browser session that created them
- **Solution**: Use Playwright browser automation to maintain session

**Architecture**:
- Railway now uses Microsoft's official Playwright Docker image
- Headless Chromium browser automation for iPOS login and scraping
- 5-minute caching to minimize browser launches
- No separate microservice needed - everything runs on Railway

**Setup**:
- **Dockerfile**: Uses `mcr.microsoft.com/playwright:v1.48.0-noble` as runner base
- **Launch flags**: `--no-sandbox`, `--disable-dev-shm-usage` for Docker compatibility
- **Service**: [lib/services/ipos-playwright-service.ts](lib/services/ipos-playwright-service.ts)
- **API Route**: [app/api/pos/dashboard/route.ts](app/api/pos/dashboard/route.ts)

**Environment Variables Required**:
```bash
IPOS_EMAIL=sipnplay@ipos.vn
IPOS_PASSWORD=<your_password>
```

**Performance**:
- First request: ~10-15 seconds (browser launch + login)
- Cached requests: <100ms (5-minute cache)
- Automatic fallback to stale cache on errors

### Staff UUID Migration (v1.19.0)
**IMPORTANT ARCHITECTURAL CHANGE**: Migrated from dual-ID system to single UUID primary key.

**Before (v1.18.x and earlier)**:
- Two separate ID fields: `staff_id` (Airtable Sip N Play) and `stafflist_id` (Airtable SNP Games List)
- Stored both in localStorage: `staff_id` and `staff_record_id`
- Complex ID mapping required for foreign keys

**After (v1.19.0+)**:
- Single UUID primary key: `staff_list.id` (generated via `gen_random_uuid()`)
- Only `staff_id` in localStorage (contains UUID)
- All foreign keys reference this single UUID
- Simplified architecture, no ID mapping needed

**Migration Script**: [scripts/migrate-staff-to-uuid.js](scripts/migrate-staff-to-uuid.js)
- Migrated 13 staff members
- Updated 107 content checks
- Updated 149 play logs
- Updated 1179 staff knowledge records

**Archived Scripts**: Old diagnostic scripts moved to [scripts/archive/](scripts/archive/) directory.

**Documentation Updates**:
- [docs/DATABASE_SERVICES_USAGE.md](docs/DATABASE_SERVICES_USAGE.md) - Updated with UUID usage examples
- [docs/AIRTABLE_SCHEMA.md](docs/AIRTABLE_SCHEMA.md) - Marked dual-ID flow as deprecated
- [docs/POSTGRESQL_MIGRATION_SUMMARY.md](docs/POSTGRESQL_MIGRATION_SUMMARY.md) - Updated table references

---

## Environment Variables

### Required

```bash
# PostgreSQL Database (CRITICAL - Required for all operations)
DATABASE_URL=postgresql://user:pass@host:port/database

# Airtable (For backfill and staff sync)
AIRTABLE_API_KEY=key_xxxxxxxxxxxxx

# Authentication
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-generate-with-openssl-rand-base64-32
```

### Optional (Uses hardcoded defaults if not set)

```bash
# Airtable Base Configuration
AIRTABLE_GAMES_BASE_ID=apppFvSDh2JBc0qAu
AIRTABLE_GAMES_TABLE_ID=tblIuIJN5q3W6oXNr
AIRTABLE_GAMES_VIEW_ID=viwRxfowOlqk8LkAd
AIRTABLE_CUSTOMER_BASE_ID=appoZWe34JHo21N1z
AIRTABLE_CUSTOMER_TABLE_ID=tblfat1kxUvaNnfaQ

# External Integrations
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxx
FACEBOOK_APP_ID=xxxxxxxxxxxxx
FACEBOOK_APP_SECRET=xxxxxxxxxxxxx
FACEBOOK_PAGE_ID=xxxxxxxxxxxxx
FACEBOOK_ACCESS_TOKEN=xxxxxxxxxxxxx
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/xxx
N8N_API_KEY=xxxxxxxxxxxxx
GOOGLE_MAPS_API_KEY=xxxxxxxxxxxxx

# iPOS/Fabi POS Integration (See docs/IPOS_API_ENDPOINTS.md)
IPOS_API_BASE_URL=https://fabi.ipos.vn/api
IPOS_API_TOKEN=your_jwt_token_here
IPOS_STORE_ID=your_store_id

# Performance (Optional)
REDIS_URL=redis://localhost:6379
```

See `.env.example` for full list and format.

---

## API Endpoints Reference

**Total Endpoints: 44+**

### Core Endpoints
- `GET /api/games` - Fetch all games from PostgreSQL
- `GET /api/games/[id]` - Single game details
- `GET /api/games/random` - Random game picker
- `POST /api/games/create` - Create new game
- `POST /api/games/[id]/edit` - Update game metadata
- `GET /api/images/[hash]` - Serve cached images

### Staff Endpoints
- `GET /api/staff-knowledge` - All expertise records
- `POST /api/staff-knowledge` - Create/update knowledge
- `GET /api/play-logs` - Game session logs
- `POST /api/play-logs` - Log new play session
- `GET /api/content-checks` - Content check history
- `POST /api/content-checks/refresh` - Refresh check cache

### Admin Endpoints (6)
- `POST /api/admin/migrate-images` - Migrate images to volume
- `GET /api/admin/storage` - Storage usage stats
- `POST /api/admin/sync-to-airtable` - Push data to Airtable
- `GET /api/admin/staging-files` - List staging files
- `POST /api/admin/copy-volume` - Copy persistent volume
- `POST /api/admin/download-images` - Download images

### Analytics & Changelog
- `GET /api/changelog` - Changelog entries
- `GET /api/changelog/stats` - Changelog statistics
- `GET /api/analytics/insights` - Analytics data

### Diagnostics
- `GET /api/health` - System health check
- `GET /api/debug/logs` - Recent application logs

**See individual route files in [app/api/](app/api/) for detailed parameters and responses.**

---

## Common Development Tasks

### Adding a New Filter
1. Define in [types/index.ts](types/index.ts) - `GameFilters` interface
2. Add filter logic in [app/games/page.tsx](app/games/page.tsx) - `useCallback` for filtering
3. Add UI component in [components/features/games/GameFilters.tsx](components/features/games/)
4. Test with various game combinations

### Adding a New Sort Option
1. Add to sort options in [app/games/page.tsx](app/games/page.tsx)
2. Implement sort logic in [lib/airtable/games-service.ts](lib/airtable/games-service.ts) - `sortGames()` method
3. Add UI option to sort dropdown

### Adding a New Database Table
1. Create migration script in [scripts/](scripts/) (e.g., `create-new-table.js`)
2. Run migration on staging database first
3. Create service class in [lib/services/](lib/services/) (e.g., `new-table-service.ts`)
4. Add API endpoints in [app/api/](app/api/)
5. Update TypeScript types in [types/index.ts](types/index.ts)
6. Test thoroughly on staging before production

### Updating Database Schema
1. Write migration script to add/modify columns
2. Test on staging database
3. Update service layer to use new fields
4. Update TypeScript types
5. Verify with test queries

### Debugging Issues
```bash
# View overall health (database, Airtable, environment)
curl http://localhost:3000/api/health

# View recent logs (last 50 entries)
curl http://localhost:3000/api/debug/logs

# Check database connection
curl http://localhost:3000/api/test-connectivity

# View storage usage (admin only)
curl http://localhost:3000/api/admin/storage
```

---

## Key Files Reference

| File | Purpose | When to Update |
|------|---------|---|
| [lib/version.ts](lib/version.ts) | Version constant shown in app | Every release |
| [package.json](package.json) | Package version (must match lib/version.ts) | Every release |
| [lib/services/games-db-service.ts](lib/services/games-db-service.ts) | Games database access | Add new game queries |
| [lib/db/postgres.ts](lib/db/postgres.ts) | PostgreSQL connection pool | Change DB config |
| [lib/airtable/games-service.ts](lib/airtable/games-service.ts) | Airtable API integration (secondary) | Backfill operations |
| [types/index.ts](types/index.ts) | TypeScript type definitions | Add new fields or tables |
| [app/games/page.tsx](app/games/page.tsx) | Main games UI and filtering | Add filters or features |
| [Dockerfile](Dockerfile) | Docker container config | Change dependencies |
| [.env.example](.env.example) | Environment variable template | Add new integrations |

---

## Deployment Workflow

1. **Local Development**
   - `npm run dev` (runs on localhost:3000+)
   - Make changes and test locally
   - `npm run build` to verify no errors

2. **Version & Commit**
   - Update [lib/version.ts](lib/version.ts) and [package.json](package.json)
   - Commit with version in message (use template above)

3. **Push to Staging**
   - `git push origin staging`
   - GitHub Actions automatically builds Docker image
   - Railway deploys to staging environment
   - Test thoroughly on staging

4. **Deploy to Production**
   - Wait for user to say "push to main"
   - `git push origin main`
   - Railway auto-deploys to production
   - Visit https://sipnplay.cafe to verify

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/STAGING_DEPLOYMENT_GUIDE.md](docs/STAGING_DEPLOYMENT_GUIDE.md) for detailed setup.

---

## Error Handling & Resilience

### Multi-Level Fallback Pattern
```
Request for /api/games:
  1. Query PostgreSQL (primary)
     ✓ Success → Return data
     ✗ Error → Log error + return empty array

  2. Image requests check persistent volume first
     ✓ Cache hit → Serve from /app/data/images/
     ✗ Cache miss → Fetch from Airtable + cache

  3. Critical errors return graceful degradation
     - Empty arrays instead of crashes
     - Stale cache if available
     - Error logs for debugging
```

### Resilience Features
- **Connection Pool**: Reuses PostgreSQL connections
- **Timeouts**: 30-second default for external APIs
- **Graceful Degradation**: Never crash, always return something
- **Persistent Volumes**: Images survive container restarts
- **Error Logging**: [lib/logger.ts](lib/logger.ts) with file persistence

---

## Documentation Structure

### Root Documentation (3 files only)
- [README.md](README.md) - Project overview
- [CLAUDE.md](CLAUDE.md) - Development workflow (this file)
- [CHANGELOG.md](CHANGELOG.md) - Version history

### Detailed Documentation → [docs/](docs/) directory (13 essential docs)
| File | Purpose |
|------|---------|
| [POSTGRESQL_MIGRATION_SUMMARY.md](docs/POSTGRESQL_MIGRATION_SUMMARY.md) | Complete migration overview |
| [DATABASE_SERVICES_USAGE.md](docs/DATABASE_SERVICES_USAGE.md) | Service layer usage guide |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Infrastructure setup |
| [STAGING_DEPLOYMENT_GUIDE.md](docs/STAGING_DEPLOYMENT_GUIDE.md) | Staging environment |
| [RAILWAY_PERSISTENT_VOLUME_SETUP.md](docs/RAILWAY_PERSISTENT_VOLUME_SETUP.md) | Persistent volume config |
| [RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md) | Railway-specific deployment |
| [CHANGELOG_IMPLEMENTATION.md](docs/CHANGELOG_IMPLEMENTATION.md) | Changelog feature details |
| [IPOS_API_ENDPOINTS.md](docs/IPOS_API_ENDPOINTS.md) | iPOS/Fabi POS API reference |
| [AIRTABLE_POSTGRES_MIGRATION.md](docs/AIRTABLE_POSTGRES_MIGRATION.md) | Migration troubleshooting |
| [AIRTABLE_SCHEMA.md](docs/AIRTABLE_SCHEMA.md) | Airtable schema reference |
| [DOCKER.md](docs/DOCKER.md) | Docker build reference |
| [GITHUB_ACTIONS_SETUP.md](docs/GITHUB_ACTIONS_SETUP.md) | CI/CD configuration |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues & fixes |

**Note**: Feature documentation (board-games-catalog, caching-system, etc.) and plan documents have been removed as features are now fully implemented and documented in code.

### Documentation Hygiene Rules

**Never Commit:**
- Session notes (SESSION_SUMMARY.md, STATUS.md)
- Status updates or temporary summaries
- Test screenshots or artifacts
- .env files or secrets

**File Lifecycle:**
- **Feature work** → Feature branch + PR (describe in PR body)
- **Status update** → Git commit messages (not STATUS.md)
- **Bug fix notes** → Code comments (not FIX_SUMMARY.md)
- **Test artifacts** → .gitignore (never commit)

---

## Custom Hooks & Utilities

### useStaffMode
- **Location**: [lib/hooks/useStaffMode.ts](lib/hooks/useStaffMode.ts)
- **Purpose**: Detect `?staff=true` URL parameter
- **Returns**: Boolean indicating staff mode is active
- **Used in**: GameDetailModal, GameCard, GameFilters components

### useAdminMode
- **Location**: [lib/hooks/useAdminMode.ts](lib/hooks/useAdminMode.ts)
- **Purpose**: Detect admin user role via NextAuth
- **Returns**: Boolean indicating admin mode is active
- **Used in**: Admin pages, admin endpoints

### Logger Singleton
- **Location**: [lib/logger.ts](lib/logger.ts)
- **Features**:
  - Console output with emoji prefixes
  - File persistence to `data/logs/`
  - In-memory buffer (last 1000 entries)
  - Methods: `info()`, `warn()`, `error()`, `debug()`, `api()`

---

## Architecture Patterns

### Separation of Concerns
- **Services** ([lib/services/](lib/services/)) - Database access layer
- **API Routes** ([app/api/](app/api/)) - Request handling and validation
- **Components** ([components/](components/)) - UI rendering
- **Hooks** ([lib/hooks/](lib/hooks/)) - Reusable client-side logic
- **Types** ([types/index.ts](types/index.ts)) - TypeScript definitions

### Key Design Principles
1. **Database-First**: PostgreSQL is primary, Airtable is secondary
2. **Service Layer**: All database access through service classes
3. **Graceful Degradation**: Errors never crash the app
4. **Content Deduplication**: Hash-based image caching
5. **Atomic Writes**: File operations use temp file + rename
6. **Connection Pooling**: Reuse PostgreSQL connections

---

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

### Database Connection Issues
- Verify `DATABASE_URL` in environment
- Check Railway PostgreSQL service status
- Test connection: `curl http://localhost:3000/api/test-connectivity`
- Review logs: `curl http://localhost:3000/api/debug/logs`

### Image Caching Issues
- Check persistent volume is mounted at `/app/data`
- Verify image files exist: `ls /app/data/images/`
- Check metadata file: `cat /app/data/image-cache-metadata.json`
- Use admin endpoint: `GET /api/admin/storage`

### Migration Script Errors
- Always test on staging database first
- Verify `DATABASE_URL` points to correct environment
- Check migration script logs for detailed errors
- Use transaction rollback on failures

---

**For detailed documentation on specific topics, see the [docs/](docs/) directory.**