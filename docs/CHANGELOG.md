# Changelog

All notable changes to the Sip n Play Board Game Catalog will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-16

### Added

#### Board Games Catalog
- Board game collection display with card-based grid layout
- Image galleries for each game (main image + gameplay image)
- Game detail modal with full information
- Search functionality (search by name or description)
- Category filtering with multi-select
- Advanced filters sheet:
  - Player count range (min/max)
  - Year range (min/max)
  - Complexity range (1-5)
  - Category multi-select
- Quick filters:
  - 6+ Players
  - Couples (2 players)
  - Party Games (8+ players)
- Sorting options:
  - Date Acquired (default)
  - Alphabetical
  - Year Released
  - Max Players
  - Complexity
- Casino-style spinner wheel for random game selection
  - 5-second animation with acceleration/deceleration
  - Respects active filters
  - Smooth animation with visual appeal

#### Server-Side Caching
- File-based cache system (`data/games-cache.json`)
- Cache-first loading strategy (no repeated Airtable API calls)
- Manual "Refresh Data" button for staff to update cache
- Automatic cache metadata tracking (last updated timestamp)
- Separate cache for content checks (`data/content-checks-cache.json`)

#### Content Checker System
- New Airtable table: Content Check Log
  - Status categorization: Perfect Condition, Minor Issues, Major Issues, Unplayable
  - Missing pieces tracking
  - Box and card condition ratings (Excellent, Good, Fair, Poor, Damaged)
  - Counterfeit detection flag
  - Inspector tracking (linked to Staff table)
  - Photo attachments support
  - Sleeved and Box Wrapped status at check time
- Migration system from old ContentsChecker table
  - Intelligent status detection from notes text
  - Missing pieces extraction
  - Latest OK report per game + ALL issue reports
  - 226 records successfully migrated
- Content check badge component (staff-only)
  - Status indicator with color coding
  - Sleeved status badge
  - Box wrapped status badge
- Content check history modal (staff-only)
  - Timeline view of all checks per game
  - Detailed information for each check
  - Inspector name display
  - Photo attachment indicators
  - Latest check highlighted
- Integration in GameDetailModal (staff-only section)
  - Latest check status display
  - Last checked date
  - Total checks count
  - Latest notes preview
  - "View History" button

#### Staff Mode
- URL parameter-based access: `?staff=true`
- Custom hook: `useStaffMode()`
- Staff-only features:
  - Content check information in game details
  - Content check history access
  - (Future: edit capabilities, admin dashboard)

#### Infrastructure
- TypeScript migration scripts with `tsx`
- Environment variable loading for standalone scripts
- Automated content check analysis and categorization
- API endpoints:
  - `/api/games` - Get all games (cached)
  - `/api/games/refresh` - Refresh games cache
  - `/api/content-checks` - Get all content checks (cached)
  - `/api/content-checks?gameId={id}` - Get checks for specific game
  - `/api/content-checks/refresh` - Refresh content checks cache

#### UI Components
- ContentCheckBadge - Display check status with icons
- ContentCheckHistory - Full check history modal
- SpinnerWheel - Casino-style game selector
- AdvancedFilters - Comprehensive filter sheet
- Version badge in top-right corner (shows build date on hover)

#### Documentation
- CHANGELOG.md - Version history (this file)
- content-checker.md - Content checker system guide
- board-games-catalog.md - Board games feature documentation
- caching-system.md - Cache implementation details
- staff-mode.md - Staff mode documentation
- STATUS.md - Development status tracking
- AIRTABLE_MANUAL_SETUP.md - Manual Airtable configuration guide

### Technical Details

**Frontend:**
- Next.js 15 App Router
- React 19 with TypeScript
- Tailwind CSS
- shadcn/ui components
- Client-side filtering with useMemo for instant updates
- Server Components for initial data fetching

**Backend:**
- Airtable as database
- Node.js file system for caching
- RESTful API routes
- Server-side caching strategy

**Data Migration:**
- 276 records in old ContentsChecker table
- 140 unique board games
- 226 records migrated (146 issue reports + 80 latest OK reports)
- 42 older duplicate OK reports skipped
- Photos not migrated (Airtable API limitation)

**Version System:**
- Version: 0.1.0
- Build date: 2025-01-16
- Fixed badge in top-right corner
- Tooltip shows build date

### Known Limitations

- Photos from old ContentsChecker table not migrated (remain in old table for reference)
- Staff mode uses URL parameter (proper authentication to be implemented)
- Inspector names visible in staff mode (proper auth required before production)

### Future Enhancements

- Proper authentication system (replace URL parameter staff mode)
- User roles and permissions
- Content check entry form for staff
- Stock inventory manager for cafe/bar items
- Admin dashboard for data management
- Photo migration solution
- Analytics and reporting

---

## Version Format

Versions follow semantic versioning: MAJOR.MINOR.PATCH

- **MAJOR**: Significant changes, breaking changes
- **MINOR**: New features, non-breaking changes
- **PATCH**: Bug fixes, minor improvements
