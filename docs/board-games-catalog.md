# Board Games Catalog

The Board Games Catalog is the main feature of the Sip n Play website, allowing customers to browse, search, and discover board games available at the cafe.

## Features

### Game Display

#### Card Grid Layout
- Responsive grid: 2-6 columns depending on screen size
  - Mobile (sm): 2 columns
  - Tablet (md): 4 columns
  - Desktop (lg): 5 columns
  - Large desktop (xl): 6 columns
- Each card shows:
  - Main game image
  - Game name
  - Player count range (with icon)
  - Year released (with icon)

#### Game Detail Modal
Full-screen overlay showing comprehensive game information:
- **Images:**
  - Main product image (aspect-square)
  - Secondary gameplay image (aspect-video)
- **Quick Info:**
  - Player count (Min - Max)
  - Year released
  - Complexity rating (1-5)
  - Date acquired
- **Categories:** Badge pills for all game categories
- **Description:** Full game description (multi-line)
- **Difficulty Rating:** Visual stars (1-5 filled circles)
- **Content Status:** (Staff only - see [Content Checker docs](./content-checker.md))

### Search & Filtering

#### Search Bar
- Real-time search (no page reload)
- Searches in:
  - Game name
  - Game description
- Case-insensitive
- Instant results as you type

#### Quick Filters
Three one-click filters for common use cases:
- **6+ Players:** Games with 6 or more max players
- **Couples:** Games playable with exactly 2 players
- **Party Games:** Games with 8+ max players

#### Advanced Filters
Comprehensive filter sheet with:

**Player Count Range:**
- Min players slider (1-10)
- Max players slider (1-10)
- Filters games where range overlaps

**Year Range:**
- Min year slider (1900-2025)
- Max year slider (1900-2025)
- Filters by release year

**Complexity Range:**
- Min complexity slider (1-5)
- Max complexity slider (1-5)
- Filters by difficulty rating

**Categories:**
- Multi-select checkboxes
- Shows all available categories
- Games must have at least one selected category

**Filter Badge:**
Shows count of active advanced filters (categories, player count, year range, complexity).

### Sorting

Five sort options (dropdown):
1. **Date Acquired** (default) - Newest additions first
2. **Alphabetical** - A to Z by game name
3. **Year Released** - Newest games first
4. **Max Players** - Highest player count first
5. **Complexity** - Simplest games first

All sorting happens **client-side** for instant results.

### Random Game Picker

Casino-style spinner wheel for selecting a random game:

#### Features
- Opens in a modal overlay
- Animated spinner with game cards
- 5-second selection process
- Acceleration and deceleration phases
- Respects active filters (only spins through filtered games)
- Shows selected game in detail modal after spin

#### Animation Details
- Total iterations: ~150 game cycles
- Initial speed: 30ms per game
- Slowdown starts: After 100 iterations
- Final speed: 330ms per game (gradual slowdown)
- Smooth acceleration curve
- 500ms pause before showing result

#### Usage
1. Click "Random Pick" button
2. Watch spinner accelerate through games
3. Spinner gradually slows down
4. Final game is selected
5. Game detail modal opens automatically

If filters are active, only filtered games are included in the spinner.

### Results Display

- **Count display:** "Showing X games"
- **No results message:** When no games match criteria
- **Loading state:** Spinner during data fetch
- **Error state:** Error message with "Try Again" button

## Data Flow

### Initial Load

1. Page component mounts
2. `fetchGames()` called
3. **Server-side:** Checks cache first (`data/games-cache.json`)
4. **Cache hit:** Returns cached games instantly
5. **Cache miss:** Fetches from Airtable, caches result, returns games
6. Categories extracted from games
7. State updated, games displayed

### Filtering & Sorting

All filtering and sorting happens **client-side** using React `useMemo`:

```typescript
const filteredAndSortedGames = useMemo(() => {
  let filtered = [...games];

  // Apply search filter
  // Apply category filter
  // Apply player count filter
  // Apply year range filter
  // Apply complexity filter
  // Apply quick filters

  // Sort results
  filtered.sort(...);

  return filtered;
}, [games, filters, sortOption]);
```

**Benefits:**
- Instant updates (no API calls)
- No page reloads
- Smooth user experience
- Reduced server load

### Cache Refresh

Manual cache refresh process:

1. Staff clicks "Refresh Data" button
2. `POST /api/games/refresh` called
3. **Server:** Fetches latest from Airtable
4. **Server:** Overwrites `data/games-cache.json`
5. **Server:** Returns success with timestamp
6. **Client:** Calls `fetchGames()` to get updated data
7. UI updates with fresh data

## Components

### GameCard
**Location:** `components/features/games/GameCard.tsx`

Displays individual game in grid:
- Image with aspect ratio
- Game name (truncated)
- Player count
- Year released
- Click handler to open detail modal

### GameDetailModal
**Location:** `components/features/games/GameDetailModal.tsx`

Full game information modal:
- Uses shadcn Dialog component
- Two-column layout (images | details)
- Responsive (single column on mobile)
- Close on backdrop click or X button
- Staff-only content check section

### SearchBar
**Location:** `components/features/games/SearchBar.tsx`

Search input with icon:
- Magnifying glass icon
- Placeholder text
- Controlled input (value from parent)
- onChange callback to parent

### GameFilters
**Location:** `components/features/games/GameFilters.tsx`

Quick filters and advanced button:
- Three quick filter buttons
- Active state styling
- Filter badge with count
- "Filters" button opens AdvancedFilters sheet

### AdvancedFilters
**Location:** `components/features/games/AdvancedFilters.tsx`

Sheet component (slides from right):
- Player count range sliders
- Year range sliders
- Complexity range sliders
- Category checkboxes
- "Reset Filters" button (clears advanced filters only)
- "Apply Filters" button (updates parent state)

### SpinnerWheel
**Location:** `components/features/games/SpinnerWheel.tsx`

Animated game selector:
- Dialog overlay
- Game card animation
- Variable speed (setInterval)
- Stop after ~150 iterations
- Callback with selected game

## API Endpoints

### GET /api/games

Fetches all games (uses cache).

**Response:**
```json
{
  "games": [...],
  "totalCount": 450,
  "categories": ["Strategy", "Party", ...]
}
```

### POST /api/games/refresh

Refreshes cache from Airtable.

**Response:**
```json
{
  "success": true,
  "count": 450,
  "previousUpdate": "2025-01-16T10:00:00.000Z",
  "currentUpdate": "2025-01-16T10:30:00.000Z"
}
```

## Styling

### Layout
- Container: `container mx-auto px-4 py-8`
- Max width: Tailwind's container (responsive)
- Padding: 4 units on all sides

### Colors
- Uses Tailwind CSS theme
- shadcn/ui design system
- Primary color for accents
- Muted colors for secondary text
- Background/foreground from theme

### Responsive Breakpoints
- `sm`: 640px (mobile)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)
- `xl`: 1280px (large desktop)

## Performance

### Optimization Strategies

1. **Server-side caching** - No repeated Airtable API calls
2. **Client-side filtering** - Instant filter updates, no network requests
3. **useMemo for expensive computations** - Avoids unnecessary re-filtering
4. **Image optimization** - Next.js Image component with lazy loading
5. **Code splitting** - Components loaded on demand
6. **Responsive images** - Multiple sizes for different viewports

### Bundle Size

Main page includes:
- Next.js runtime
- React 19
- shadcn/ui components (tree-shaken)
- Tailwind CSS (purged unused styles)
- Lucide icons (imported individually)

## Accessibility

- Semantic HTML (`button`, `dialog`, `label`)
- Keyboard navigation supported
- Screen reader friendly
- Focus management in modals
- Alt text on all images
- ARIA labels where needed

## Future Enhancements

### Phase 1: Wishlist
- User accounts
- Save favorite games
- "Want to Play" list
- Recently viewed history

### Phase 2: Availability
- Check if game is currently at table
- Reserve game ahead of time
- Real-time availability status
- "Coming Soon" games

### Phase 3: Social Features
- User ratings and reviews
- Game recommendations based on preferences
- "People who liked X also liked Y"
- Community top picks

### Phase 4: Advanced Search
- BGG integration (ratings, rankings)
- Mechanic-based filtering
- Designer/Publisher search
- Expansion/base game filtering
- Language dependency indication

## Troubleshooting

### Games not loading
1. Check network tab for API errors
2. Verify Airtable credentials in `.env.local`
3. Check cache file exists: `data/games-cache.json`
4. Try manual refresh with "Refresh Data" button

### Filters not working
1. Filters work client-side, check console for JavaScript errors
2. Verify filter state is updating (React DevTools)
3. Check useMemo dependencies array

### Images not displaying
1. Verify Airtable images have public URLs
2. Check Next.js Image component configuration
3. Ensure images are properly sized
4. Check network tab for failed image requests

### Spinner wheel not smooth
1. Check browser performance
2. Reduce number of games in spinner
3. Adjust animation speed in SpinnerWheel component
4. Test on different devices
