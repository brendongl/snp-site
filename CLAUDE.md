# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: January 14, 2025
**Current Version**: 1.9.6
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

### Frontend Design & Aesthetics

**Purpose**: Avoid generic "AI slop" aesthetics and create distinctive, intentional user interfaces.

**Core Problem**: Without explicit guidance, AI-generated designs tend toward conservative, predictable outputs that lack character and distinctiveness.

**Key Prompting Strategies:**

1. **Guide Specific Design Dimensions**
   - Focus attention individually on typography, color, motion, and backgrounds
   - Prevents defaulting to safe, middle-ground choices
   - Request targeted improvements rather than general "make it better"

2. **Reference Design Inspirations**
   - Suggest concrete sources: IDE themes, cultural aesthetics, design systems
   - Anchors design direction without limiting creativity
   - Example: "Draw inspiration from Tokyo Neon" or "Use Dracula theme palette"

3. **Call Out Common Defaults to Avoid**
   - Overused font families: Inter, Roboto, Arial, system fonts
   - Clichéd color schemes: purple gradients on white backgrounds
   - Generic layouts: centered cards with subtle shadows
   - Predictable animations: simple fade-ins

**Design Dimension Guidelines:**

**Typography:**
- Choose distinctive fonts; avoid generic families
- Use CSS variables for consistency
- Pair fonts with high contrast (not subtle differences)
- Consider: display fonts for headings, readable fonts for body

**Color & Theme:**
- Commit to cohesive palettes with dominant colors and sharp accents
- Draw from IDE themes or cultural aesthetics for inspiration
- Avoid: generic blue/purple gradients, safe gray backgrounds
- Consider: dark mode first, high contrast ratios, brand identity

**Motion:**
- Prioritize CSS-only solutions for HTML/React components
- Orchestrate high-impact moments (page loads, transitions)
- Use staggered reveals with `animation-delay`
- Avoid: generic fade-ins, over-animated interfaces

**Backgrounds:**
- Create atmosphere through layered CSS gradients
- Use geometric patterns rather than solid colors
- Consider: mesh gradients, noise textures, subtle animations
- Avoid: plain white/gray backgrounds

**Practical Application:**

When working on UI components:
1. **Before coding**: Discuss design direction and inspirations
2. **During implementation**: Focus on one dimension at a time
3. **After initial version**: Refine typography, then color, then motion
4. **Lock in themes**: Reuse established design tokens across features

**Examples:**

```
❌ DON'T: "Make this component look better"
✅ DO: "Update the color palette to use high-contrast Tokyo Neon colors with sharp accent pops"

❌ DON'T: Use system fonts without consideration
✅ DO: "Choose a distinctive display font for headings that contrasts with body text"

❌ DON'T: Add generic purple gradient backgrounds
✅ DO: "Create a layered mesh gradient background inspired by [specific design system]"
```

**For This Project (Sip & Play):**

**Brand Color Palette** (defined in [public/mockups/index.html](public/mockups/index.html)):
- **Primary Cyan**: `#00B4D8` - Main brand color (bright cyan/turquoise)
- **Primary Orange**: `#F77F00` - Secondary brand color (vibrant orange)
- **Cream**: `#FFF4E6` - Warm background/accent
- **Brown**: `#8B4513` - Coffee/earthy tone
- **White**: `#FFFFFF` - Clean backgrounds
- **Light Gray**: `#F5F5F5` - Subtle backgrounds
- **Brand Gradient**: `linear-gradient(135deg, #00B4D8 0%, #F77F00 100%)` (cyan to orange)

**Design Guidelines:**
- Game cafe aesthetic: playful but professional
- Color usage: Cyan (`#00B4D8`) for primary actions, Orange (`#F77F00`) for accents and CTAs
- Avoid: Corporate blue/purple, generic gray backgrounds
- Inspiration: Board game box art, retro arcade themes, coffee shop warmth
- Typography: Friendly, readable fonts that work in Vietnamese and English (consider DM Sans for headings, Inter for body)
- Motion: Subtle, purposeful animations that enhance UX (no excessive effects)
- Backgrounds: Use cream (`#FFF4E6`) or light gray (`#F5F5F5`) for warmth, not stark white

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

All database access goes through service classes in [lib/services/](lib/services/). Key services include:
- **games-db-service.ts** - Games CRUD operations
- **roster-db-service.ts** - Roster management (22 methods)
- **roster-solver-service.ts** - AI constraint solving
- **vikunja-service.ts** - Task management integration
- **staff-knowledge-db-service.ts** - Expertise tracking

**See [docs/DATABASE_SERVICES_USAGE.md](docs/DATABASE_SERVICES_USAGE.md) for complete service reference and usage examples.**

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
│   ├── api/                      # API routes (60+ endpoints)
│   │   ├── games/               # Games CRUD endpoints
│   │   ├── images/              # Image caching & serving
│   │   ├── content-checks/      # Content check logs
│   │   ├── roster/              # Roster management (14+ endpoints)
│   │   ├── clock-in/            # Clock in/out system
│   │   ├── admin/               # Admin-only operations
│   │   ├── staff/               # Staff operations
│   │   ├── play-logs/           # Play session tracking
│   │   ├── changelog/           # Changelog data
│   │   └── analytics/           # Analytics insights
│   ├── games/                   # Games catalog page
│   ├── staff/                   # Staff-only pages
│   │   ├── roster/              # View roster calendar
│   │   ├── availability/        # Edit weekly availability
│   │   ├── clock-in/            # Clock in/out
│   │   ├── my-hours/            # Hours & pay dashboard
│   │   ├── knowledge/           # Staff expertise management
│   │   ├── play-logs/           # Play session logs
│   │   ├── changelog/           # Changelog viewer
│   │   ├── check-history/       # Content check history
│   │   └── add-knowledge/       # Add expertise
│   ├── admin/                   # Admin-only pages
│   │   ├── roster/              # Roster management
│   │   │   ├── calendar/        # Edit roster calendar
│   │   │   ├── rules/           # Manage rostering rules
│   │   │   ├── staff-config/    # Payroll configuration
│   │   │   ├── clock-records/   # View clock records
│   │   │   └── hours-approval/  # Approve hours
│   │   └── approvals/           # General approval queue
│   └── page.tsx                 # Home page
├── components/                   # React components
│   └── features/                # Feature-specific components
│       ├── roster/              # Roster UI components (6 files)
│       ├── games/               # Games UI components
│       └── staff/               # Staff UI components
├── lib/                         # Utility libraries
│   ├── services/                # Database service layer (11 files)
│   │   ├── roster-db-service.ts        # Roster data access
│   │   ├── roster-solver-service.ts    # AI constraint solver
│   │   ├── roster-cron-service.ts      # Automated tasks
│   │   └── rule-parser-service.ts      # Natural language parsing
│   ├── db/                      # PostgreSQL connection pool
│   ├── cache/                   # Cache management
│   ├── airtable/                # Airtable API (secondary)
│   ├── hooks/                   # Custom React hooks
│   ├── storage/                 # Persistent volume management
│   ├── analytics/               # Mixpanel integration
│   ├── discord/                 # Discord webhooks
│   └── version.ts               # Version constant (UPDATE THIS!)
├── scripts/                     # Migration & utility scripts (50+ files)
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

### Other Core Features

**Changelog System** - Version tracking, analytics, staff activity logs
- Service: [lib/services/changelog-service.ts](lib/services/changelog-service.ts) | Docs: [CHANGELOG_IMPLEMENTATION.md](docs/CHANGELOG_IMPLEMENTATION.md)

**Play Logs** - Game session tracking (player counts, duration, staff logging)
- Service: [lib/services/play-logs-db-service.ts](lib/services/play-logs-db-service.ts)

**Staff Knowledge Management** - Expertise tracking with confidence levels
- Service: [lib/services/staff-knowledge-db-service.ts](lib/services/staff-knowledge-db-service.ts)

**BoardGameGeek Integration** - Game metadata enrichment
- Service: [lib/services/bgg-api.ts](lib/services/bgg-api.ts)

**Analytics** - Mixpanel integration for page views and event tracking
- [lib/analytics/mixpanel.ts](lib/analytics/mixpanel.ts)

### Vikunja Task Management (v1.4.0+)

**Status**: ✅ Production ready - Fully implemented and tested

Staff task management with gamified points system integrated into dashboard. Tasks show 3-day visibility with color-coded priorities (red/orange/blue), one-click completion awards points.

**Key Components**:
- Instance: https://tasks.sipnplay.cafe (self-hosted on Railway)
- Service: [lib/services/vikunja-service.ts](lib/services/vikunja-service.ts)
- Dashboard: [app/staff/dashboard/page.tsx](app/staff/dashboard/page.tsx)
- All 13 staff have linked accounts with point tracking

**Documentation**: See [docs/VIKUNJA_TASK_WORKFLOW.md](docs/VIKUNJA_TASK_WORKFLOW.md) for complete workflow and [docs/VIKUNJA_WORKAROUNDS.md](docs/VIKUNJA_WORKAROUNDS.md) for known issues.

### iPOS Integration with Playwright (v1.7.7)

**Status**: ✅ Production ready

POS data scraping using headless Chromium (tokens are session-bound, cannot use direct API calls).

**Setup**: Service at [lib/services/ipos-playwright-service.ts](lib/services/ipos-playwright-service.ts), 5-minute caching, auto-fallback.
**Docs**: [docs/IPOS_API_ENDPOINTS.md](docs/IPOS_API_ENDPOINTS.md)

### Staff UUID Migration (v1.19.0)

**Status**: ✅ Complete - Migrated from dual-ID to single UUID primary key

Now uses single `staff_list.id` (UUID) instead of dual Airtable IDs. Migration script: [scripts/migrate-staff-to-uuid.js](scripts/migrate-staff-to-uuid.js)

### Nintendo Switch Webhook Notifications (v1.7.12)

**Status**: ✅ Production ready

Real-time toast notifications (SSE) when Switch games launch/exit. Uses Cloudflare Worker HTTP bridge for Switch compatibility.

**Config**: `http://switch-webhook.brendonganle.workers.dev/` → [/api/switch-webhook](app/api/switch-webhook/route.ts)
**Docs**: [docs/SWITCH_WEBHOOK_NOTIFICATIONS.md](docs/SWITCH_WEBHOOK_NOTIFICATIONS.md)

### AI-Powered Roster Management System (v1.9.x)

**Status**: ✅ ~85% Complete - Core features fully operational, integrations pending

Comprehensive staff rostering system with AI-powered schedule generation, clock-in/out tracking, payroll calculation, and approval workflows.

**Key Features**:
- Interactive 7-day availability editor with tap-to-cycle color coding
- GPS-tracked clock-in/out with points-based punctuality rewards
- Hours & pay dashboard with VND payroll calculation (base/weekend/holiday/overtime multipliers)
- Homebase-style roster calendar with drag-and-drop shift management
- Natural language rule parser (Claude API) for rostering constraints
- 14+ API endpoints, 4 backend services, 9 database tables
- Admin approval workflows for hour adjustments and shift swaps

**Live Pages**:
- Staff: `/staff/availability`, `/staff/clock-in`, `/staff/my-hours`, `/staff/roster/calendar`
- Admin: `/admin/roster/calendar`, `/admin/roster/rules`, `/admin/roster/staff-config`, `/admin/roster/clock-records`, `/admin/roster/hours-approval`, `/admin/approvals`

**Documentation**:
- Design: [docs/plans/2025-01-11-ai-rostering-system-design.md](docs/plans/2025-01-11-ai-rostering-system-design.md)
- Implementation Status: [docs/plans/2025-01-14-rostering-implementation-status.md](docs/plans/2025-01-14-rostering-implementation-status.md)

**Security Issues** ⚠️ (Must fix before production):
- `/api/roster/generate` lacks authentication, rate limiting, timeout, and validation

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

# OpenRouter API (AI-powered rostering - natural language rule parsing)
# Get your API key from: https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

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

**60+ endpoints** organized in [app/api/](app/api/) directory:
- **Games**: CRUD, random picker, BGG integration
- **Staff**: Knowledge management, play logs, content checks
- **Roster**: 14+ endpoints (shifts, availability, clock system, rules, payroll)
- **Admin**: Storage, migrations, approvals, sync operations
- **Analytics**: Changelog, insights, staff activity
- **Diagnostics**: Health checks, logs

**See individual route files in [app/api/](app/api/) for detailed parameters and responses.**

---

## Common Development Tasks

### Adding Database Tables/Schemas
1. Create migration script in [scripts/](scripts/)
2. Test on staging database first
3. Create service class in [lib/services/](lib/services/)
4. Add API endpoints in [app/api/](app/api/)
5. Update types in [types/index.ts](types/index.ts)

### Debugging Endpoints
- `/api/health` - System health (database, Airtable, environment)
- `/api/debug/logs` - Recent logs (last 50 entries)
- `/api/admin/storage` - Storage usage (admin only)

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

**useStaffMode** ([lib/hooks/useStaffMode.ts](lib/hooks/useStaffMode.ts)) - Detects `?staff=true` URL parameter

**useAdminMode** ([lib/hooks/useAdminMode.ts](lib/hooks/useAdminMode.ts)) - Detects admin role via NextAuth

**Logger** ([lib/logger.ts](lib/logger.ts)) - Console output, file persistence, in-memory buffer (1000 entries)

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

**Build Issues**: `rm -rf .next && npm run build`

**Database Connection**: Check `DATABASE_URL` env var, test with `/api/health` or `/api/debug/logs`

**Image Caching**: Verify persistent volume at `/app/data/images/` or check `/api/admin/storage`

**For detailed troubleshooting, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)**

---

**For detailed documentation on specific topics, see the [docs/](docs/) directory.**