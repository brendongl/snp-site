# Sip n Play Board Game Catalog - Documentation

Welcome to the documentation for the Sip n Play Board Game Catalog website.

## Table of Contents

### Features

- [Board Games Catalog](./board-games-catalog.md) - Main catalog with search, filters, and random picker
- [Content Checker System](./content-checker.md) - Game condition tracking and history
- [Caching System](./caching-system.md) - Server-side caching implementation
- [Staff Mode](./staff-mode.md) - Staff-only features and access

### Meta

- [CHANGELOG](./CHANGELOG.md) - Version history and release notes

## Quick Start

### For Customers

Visit `/games` to browse the board game collection:

1. **Search** for games by name or description
2. **Filter** by categories, player count, year, complexity
3. **Sort** by date acquired, alphabetical, year, players, complexity
4. **Random Pick** to let the spinner wheel choose a game for you
5. **Click any game** to see full details and images

### For Staff

Add `?staff=true` to any URL to access staff features:

1. **Refresh Data** button to update games from Airtable
2. **Content Status** section in game details showing condition
3. **View History** button to see all content checks for a game
4. See inspector names and detailed check information

Examples:
- `https://yourdomain.com/games?staff=true`

## Architecture

### Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Node.js
- **Database:** Airtable
- **Caching:** File-based (JSON files on server)
- **Deployment:** Vercel/Netlify compatible

### Project Structure

```
snp-site/
├── app/
│   ├── api/
│   │   ├── games/
│   │   │   ├── route.ts              # Get games (cached)
│   │   │   └── refresh/route.ts      # Refresh games cache
│   │   └── content-checks/
│   │       ├── route.ts              # Get content checks
│   │       └── refresh/route.ts      # Refresh checks cache
│   ├── games/
│   │   └── page.tsx                  # Main catalog page
│   └── layout.tsx
├── components/
│   ├── features/
│   │   ├── games/
│   │   │   ├── GameCard.tsx
│   │   │   ├── GameDetailModal.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── GameFilters.tsx
│   │   │   ├── AdvancedFilters.tsx
│   │   │   └── SpinnerWheel.tsx
│   │   └── content-check/
│   │       ├── ContentCheckBadge.tsx
│   │       └── ContentCheckHistory.tsx
│   └── ui/                           # shadcn/ui components
├── lib/
│   ├── airtable/
│   │   ├── games-service.ts
│   │   └── content-checker-service.ts
│   ├── cache/
│   │   └── games-cache.ts
│   ├── hooks/
│   │   └── useStaffMode.ts
│   └── version.ts
├── types/
│   └── index.ts
├── data/                             # Cache directory
│   ├── games-cache.json
│   └── content-checks-cache.json
├── docs/                             # Documentation (you are here)
│   ├── README.md
│   ├── CHANGELOG.md
│   ├── board-games-catalog.md
│   ├── content-checker.md
│   ├── caching-system.md
│   └── staff-mode.md
└── scripts/
    ├── migrate-content-checks.ts
    └── AIRTABLE_MANUAL_SETUP.md
```

## Environment Variables

Required in `.env.local`:

```env
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

## Airtable Structure

### Tables

1. **BG List** - Board games
   - Game Name, Description, Images
   - Player counts, Year, Complexity
   - Categories, Acquisition date
   - Sleeved, Box Wrapped (booleans)
   - Content check rollup/lookup fields

2. **Content Check Log** - Game condition history
   - Board Game (link to BG List)
   - Check Date, Inspector
   - Status (Perfect/Minor/Major/Unplayable)
   - Missing Pieces, Box/Card Condition
   - Sleeved At Check, Box Wrapped At Check
   - Photos, Notes, Is Fake flag

3. **Staff** - Staff members (for inspector links)

### Manual Setup Required

Some fields must be created manually in Airtable:
- See [AIRTABLE_MANUAL_SETUP.md](../scripts/AIRTABLE_MANUAL_SETUP.md)

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Run Migration

```bash
npm run migrate:content-checks
```

## Key Concepts

### Server-Side Caching

All data is cached on the server to avoid repeated Airtable API calls:
- First load: Fetch from Airtable → Cache → Return
- Subsequent loads: Read cache → Return (instant!)
- Manual refresh: Staff triggers update

See: [Caching System](./caching-system.md)

### Client-Side Filtering

All filtering and sorting happens in the browser:
- No API calls when filtering
- Instant results
- Smooth user experience
- Uses React useMemo for optimization

See: [Board Games Catalog](./board-games-catalog.md)

### Staff Mode

URL parameter-based staff access:
- Add `?staff=true` to URL
- Shows additional features
- No authentication (temporary solution)
- Will be replaced with proper auth

See: [Staff Mode](./staff-mode.md)

### Content Checking

Track game condition over time:
- Status categorization (Perfect/Minor/Major/Unplayable)
- Missing pieces tracking
- Box/card condition ratings
- History timeline
- Staff-only visibility

See: [Content Checker System](./content-checker.md)

## Common Tasks

### Adding New Games

1. Add game to "BG List" table in Airtable
2. Visit site with `?staff=true`
3. Click "Refresh Data" button
4. New game appears in catalog

### Recording Content Check

1. Add record to "Content Check Log" in Airtable
2. Link to board game
3. Set status, conditions, notes
4. Visit site with `?staff=true`
5. Click "Refresh Data" button
6. View check in game detail modal

### Updating Game Information

1. Edit game in Airtable "BG List"
2. Visit site with `?staff=true`
3. Click "Refresh Data" button
4. Changes reflected on site

### Checking Cache Status

1. Look for "Last updated" in API responses
2. Check `data/` directory for cache files
3. View file modification times
4. Verify record counts match Airtable

## Troubleshooting

### Games Not Loading

1. Check `.env.local` has correct API key and base ID
2. Verify Airtable table names match code
3. Check browser console for errors
4. Try manual refresh

### Filters Not Working

1. Open browser console
2. Check for JavaScript errors
3. Verify filter state updates (React DevTools)
4. Clear browser cache

### Content Checks Not Showing

1. Verify using `?staff=true` in URL
2. Check manual Airtable fields were created
3. Refresh content checks cache
4. Verify links between tables

### Cache Not Updating

1. Check "Refresh Data" actually runs
2. Verify `data/` directory is writable
3. Check server logs for errors
4. Confirm API endpoint returns success

## Support

For issues, questions, or feature requests:
- Check documentation first
- Review common tasks section
- Consult troubleshooting guide
- Check browser console for errors

## Version

Current version: **v0.1.0**
Build date: **2025-01-16**

See [CHANGELOG](./CHANGELOG.md) for detailed version history.

## Future Roadmap

### Phase 1: Core Improvements
- Proper authentication system
- User accounts and sessions
- Role-based access control

### Phase 2: Enhanced Features
- BGG integration (ratings, rankings)
- User wishlists and favorites
- Game recommendations
- Advanced search with mechanics

### Phase 3: Staff Tools
- Content check entry form
- Mobile app for checks
- Bulk operations
- Analytics dashboard

### Phase 4: Customer Experience
- Availability tracking
- Game reservations
- User reviews and ratings
- Community features

## Contributing

When making changes:
1. Update relevant documentation
2. Test thoroughly
3. Update CHANGELOG.md
4. Increment version number if needed
5. Document any breaking changes
