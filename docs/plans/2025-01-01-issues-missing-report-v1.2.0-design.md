# v1.2.0 Design: Issues/Missing Report & Staff UI Improvements

**Date:** January 1, 2025
**Version:** 1.2.0
**Status:** Approved for Implementation
**Deployment:** Big Bang to staging → main

---

## Overview

Complete rework of the content check system to better track game issues, improve staff workflows, and enhance UI/UX for staff mode.

---

## Core Changes

### 1. Issues/Missing Report Rework

**Current System:**
- `missing_pieces` TEXT field (optional, free text)
- "Missing Pieces Inventory" shows games with text in this field
- "Mark Found" appends " - Found!" to text

**New System:**
- Add `has_issue` BOOLEAN to `content_checks` table
- Toggle in ContentCheckDialog forces intentional issue reporting
- "Issues/Missing Report" shows games where latest check has `has_issue=true`
- "Resolved" button creates new check with proper status tracking

**Why:** Prevents accidental issue reports (e.g., "All Good" in missing pieces field), provides structured data for future points system.

---

## Database Schema Changes

### `content_checks` Table Additions

```sql
ALTER TABLE content_checks
ADD COLUMN has_issue BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN resolved_by_id UUID REFERENCES staff_list(id),
ADD COLUMN resolved_from_check_id TEXT REFERENCES content_checks(id);

-- Indexes for performance
CREATE INDEX idx_content_checks_has_issue ON content_checks(has_issue) WHERE has_issue = true;
CREATE INDEX idx_content_checks_resolved_by ON content_checks(resolved_by_id) WHERE resolved_by_id IS NOT NULL;
```

**Field Descriptions:**
- `has_issue`: TRUE when toggle enabled + issue text exists, FALSE otherwise
- `resolved_by_id`: Staff UUID who clicked "Resolved" (NULL for regular checks)
- `resolved_from_check_id`: Links to original check that had the issue (NULL for regular checks)

**Migration Strategy:**
- All existing checks: `has_issue = false` (backward compatible)
- No data loss: existing `missing_pieces` text preserved
- Indexes only on TRUE values (performance optimization)

---

## Feature 1: Content Check Issue Toggle

### UI Behavior by Status

| Status | Toggle State | Issue Text Required | Logic |
|--------|-------------|---------------------|-------|
| Perfect Condition | **DISABLED** (grayed out, OFF) | No | Can't have issues if perfect |
| Minor Issues | **ENABLED** (default OFF) | Only if toggle ON | Staff decides if reportable |
| Major Issues | **LOCKED ON** | **YES** | Must describe the problem |
| Unplayable | **LOCKED ON** | **YES** | Must describe the problem |

### Form Validation Rules

**ContentCheckDialog.tsx:**
```typescript
// Before submission
if (status === 'Perfect Condition' && hasIssueToggle === true) {
  throw new Error('Cannot have issues with Perfect Condition status');
}

if ((status === 'Major Issues' || status === 'Unplayable') && !issueText.trim()) {
  throw new Error('Issue description required for this status');
}

// Set has_issue flag
const hasIssue = hasIssueToggle && issueText.trim().length > 0;
```

### Database Write

```typescript
await contentChecksDbService.createCheck({
  gameId,
  inspectorId,
  checkDate: new Date().toISOString(),
  checkType: 'regular',
  status: [selectedStatus],
  missingPieces: issueText || null, // Existing field
  has_issue: hasIssue, // NEW FIELD
  // ... other fields
});
```

---

## Feature 2: Issues/Missing Report Page

### Renamed Component

**Old:** `MissingPiecesInventory.tsx`
**New:** `IssuesMissingReport.tsx`

### Data Query Logic

```sql
-- Get games with unresolved issues
SELECT DISTINCT ON (cc.game_id)
  cc.game_id,
  cc.missing_pieces as issue_description,
  g.name as game_name,
  cc.id as check_id,
  sl.staff_name as reported_by,
  cc.check_date as reported_date,
  cc.notes
FROM content_checks cc
INNER JOIN games g ON cc.game_id = g.id
LEFT JOIN staff_list sl ON cc.inspector_id = sl.id
WHERE cc.has_issue = true
ORDER BY cc.game_id, cc.check_date DESC;
```

**Key Change:** Only show latest check per game. If latest check has `has_issue=false`, the game doesn't appear in the report (issue was resolved).

### "Resolved" Button Flow

**When staff clicks "Resolved":**

1. Show dialog: **"Is the game now in Perfect Condition?"**
   - **YES** → Create new check:
     - `status = 'Perfect Condition'`
     - `has_issue = false`
     - `missing_pieces = null`
     - `resolved_by_id = current_staff_id`
     - `resolved_from_check_id = original_check_id`

   - **NO** → Show input: "Describe remaining issues"
     - Create new check:
     - `status = 'Minor Issues'`
     - `has_issue = true`
     - `missing_pieces = user_input_text`
     - `resolved_by_id = current_staff_id`
     - `resolved_from_check_id = original_check_id`

2. Close dialog
3. Show toast: "Issue resolved for {gameName}" (foreground, above game dialog)
4. Refresh Issues/Missing Report list

**UI Changes:**
- Rename button: "Mark Found" → **"Resolved"**
- Header: "Missing Pieces Inventory" → **"Issues/Missing Report"**

---

## Feature 3: Staff Dashboard Priority Actions

### Add Issues Section

**StaffDashboard.tsx** → Priority Actions card:

```typescript
// Fetch games with issues
const gamesWithIssues = await fetch('/api/content-checks/needs-attention');

// Display
<Card>
  <h3>🚨 Games Needing Attention ({gamesWithIssues.length})</h3>
  {gamesWithIssues.map(game => (
    <div className="border-l-4 border-red-500 pl-3">
      <p className="font-semibold">{game.name}</p>
      <p className="text-sm text-red-600">{game.issue_description}</p>
      <p className="text-xs">Reported by {game.reported_by} on {game.reported_date}</p>
    </div>
  ))}
</Card>
```

**New API Endpoint:** `GET /api/content-checks/needs-attention`

---

## Feature 4: Staff Mode GameCard UI

### Visual Changes

**Remove when in staff mode:**
- Categories text line (e.g., "Strategy, Family")
- Status badges for perfect condition games

**Add when in staff mode:**
- 📚 icon with check count (e.g., "📚 3")
- Red outline for games with `has_issue=true`
- Issue text in red (replaces categories area)

**Compact Layout:**
- Reduce padding: `p-3` → `p-2`
- Smaller font sizes: `text-sm` → `text-xs`
- Tighter spacing

### GameCard.tsx Changes

```tsx
{isStaff && (
  <div className="p-2"> {/* Reduced from p-3 */}
    <h3 className="font-semibold text-xs line-clamp-2 mb-1">
      {game.fields['Game Name']}
    </h3>

    {/* Issue text (replaces categories) */}
    {game.latestCheck?.has_issue && (
      <p className="text-xs text-red-600 font-medium mb-1">
        ⚠️ {game.latestCheck.missing_pieces}
      </p>
    )}

    {/* Check count with icon */}
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>📚</span>
      <span>{game.fields['Total Checks'] || 0}</span>
    </div>
  </div>
)}

{/* Red outline for issue games */}
<div className={`... ${isStaff && game.latestCheck?.has_issue ? 'ring-2 ring-red-500' : ''}`}>
```

---

## Feature 5: Auto-Float Issue Games to Top

### Sorting Logic (GamesPage.tsx)

```typescript
const sortedGames = useMemo(() => {
  let sorted = [...filteredGames];

  // If no sort applied, float issue games to top
  if (!currentSort || currentSort === 'default') {
    sorted = sorted.sort((a, b) => {
      const aHasIssue = a.latestCheck?.has_issue || false;
      const bHasIssue = b.latestCheck?.has_issue || false;

      if (aHasIssue && !bHasIssue) return -1;
      if (!aHasIssue && bHasIssue) return 1;
      return 0; // Maintain original order
    });
  } else {
    // Apply selected sort (A-Z, Most Checked, etc.)
    // Issue games still have red outline but don't auto-float
    sorted = applySortLogic(sorted, currentSort);
  }

  return sorted;
}, [filteredGames, currentSort]);
```

### Add "Has Issues" Filter

**GameFilters.tsx** sort dropdown:
```tsx
<SelectItem value="has-issues">Has Issues</SelectItem>
```

**Filter logic:**
```typescript
if (sortOption === 'has-issues') {
  return games.filter(game => game.latestCheck?.has_issue === true);
}
```

---

## Feature 6: Knowledge Badge Clickable + Edit Mode

### Make Badge Clickable

**GameCard.tsx:**
```tsx
{/* Staff Knowledge Badge - bottom left overlay */}
{isStaff && staffKnowledgeLevel && (
  <button
    onClick={(e) => {
      e.stopPropagation(); // Don't open game modal
      handleKnowledgeBadgeClick();
    }}
    className="absolute bottom-2 left-2 z-20 cursor-pointer hover:scale-110 transition-transform"
  >
    <div className={`w-8 h-8 rounded-full ${badgeColor} shadow-lg`}>
      {/* checkmark icon */}
    </div>
  </button>
)}
```

**Mobile Fix:**
- Increase touch target size: `w-8 h-8` → `w-10 h-10` on mobile (`sm:w-8 sm:h-8`)
- Add `touch-action: manipulation` to prevent double-tap zoom

### Edit Mode Logic

**AddGameKnowledgeDialog.tsx:**

```typescript
const [isEditMode, setIsEditMode] = useState(false);
const [existingKnowledge, setExistingKnowledge] = useState(null);

useEffect(() => {
  if (isOpen) {
    // Check if staff already has knowledge for this game
    const staffId = localStorage.getItem('staff_id');
    const response = await fetch(`/api/staff-knowledge?gameId=${gameId}&staffId=${staffId}`);

    if (response.ok) {
      const data = await response.json();
      if (data.knowledge) {
        setIsEditMode(true);
        setExistingKnowledge(data.knowledge);
        setConfidenceLevel(data.knowledge.confidence_level);
        setNotes(data.knowledge.notes || '');
      }
    }
  }
}, [isOpen, gameId]);
```

**UI Changes in Edit Mode:**

| Field | Add Mode | Edit Mode |
|-------|----------|-----------|
| Dialog Title | "Add Game Knowledge" | **"Edit Game Knowledge"** |
| Description | "Recording your knowledge for {game}" | **"Edit your knowledge for {game}"** |
| Confidence Level | Empty, must select | **Pre-filled with existing level** |
| Was Taught By | Dropdown visible | **HIDDEN** (no changes allowed) |
| Notes | Empty | **Pre-filled with existing notes** |
| Submit Button | "Save Knowledge" | **"Update Knowledge"** (disabled if no changes) |
| Additional Button | None | **"Delete Knowledge"** (red, destructive) |

**Delete Knowledge Flow:**
```typescript
const handleDelete = async () => {
  await fetch(`/api/staff-knowledge/${existingKnowledge.id}`, {
    method: 'DELETE'
  });

  onClose();
  showToast('Knowledge deleted for {gameName}', 'success'); // Foreground toast
  onSuccess(); // Trigger parent refresh
};
```

---

## Feature 7: Content Check Auto-Refresh

### Current Bug
After submitting content check, games list still shows old check count (0 checks) even after page refresh.

### Root Cause
Games data cached in component state, not invalidated after content check creation.

### Fix

**ContentCheckDialog.tsx:**
```typescript
const handleSubmit = async () => {
  // ... create content check ...

  if (response.ok) {
    addToast('Content check created successfully!', 'success');
    onSuccess(); // Call parent's refresh function
    onClose();
  }
};
```

**GameDetailModal.tsx:**
```typescript
<ContentCheckDialog
  open={showContentCheck}
  onClose={() => setShowContentCheck(false)}
  game={game}
  onSuccess={() => {
    // Trigger parent (GamesPage) to refresh
    onRefresh?.();
  }}
/>
```

**GamesPage.tsx:**
```typescript
const handleRefreshGames = useCallback(async () => {
  setLoading(true);
  const response = await fetch('/api/games');
  const data = await response.json();
  setGames(data.games);
  setLoading(false);
}, []);

<GameDetailModal
  game={selectedGame}
  open={!!selectedGame}
  onClose={() => setSelectedGame(null)}
  onRefresh={handleRefreshGames} // Pass refresh callback
/>
```

---

## API Endpoints

### New Endpoints

**`GET /api/content-checks/needs-attention`**
- Returns games with `has_issue=true` on latest check
- Used by Staff Dashboard and Issues/Missing Report

**`POST /api/content-checks/resolve`**
- Accepts: `checkId`, `isPerfect`, `remainingIssues` (optional)
- Creates new check with resolution tracking
- Returns: new check ID

**`GET /api/staff-knowledge?gameId=X&staffId=Y`**
- Returns existing knowledge record if found
- Used to detect edit mode in dialog

**`DELETE /api/staff-knowledge/:id`**
- Deletes knowledge record
- Returns 204 No Content on success

### Modified Endpoints

**`POST /api/games/content-check`**
- Add `has_issue`, `resolved_by_id`, `resolved_from_check_id` to request body
- Update ContentChecksDbService to handle new fields

---

## Testing Strategy

### Database Migration Tests
1. Run migration on staging database
2. Verify columns exist: `SELECT * FROM content_checks LIMIT 1;`
3. Verify indexes created: `\d content_checks`
4. Create test check with `has_issue=true`, verify it appears in Issues/Missing Report
5. Resolve issue, verify it disappears from report

### Content Check Toggle Tests
1. Perfect Condition → Toggle disabled ✓
2. Minor Issues → Toggle manual, issue text optional ✓
3. Major Issues → Toggle locked ON, issue text required ✓
4. Unplayable → Toggle locked ON, issue text required ✓
5. Submit with toggle ON + no text → Validation error ✓

### Resolution Flow Tests
1. Click "Resolved" → Dialog appears ✓
2. Select "YES" → Creates Perfect Condition check ✓
3. Select "NO" → Shows input field ✓
4. Submit with remaining issues → Creates Minor Issues check ✓
5. Verify `resolved_by_id` and `resolved_from_check_id` populated ✓

### Staff Mode UI Tests
1. Staff mode enabled → Categories hidden ✓
2. Staff mode enabled → Check count shows 📚 icon ✓
3. Game has issue → Red outline visible ✓
4. Game has issue → Issue text replaces categories ✓
5. No sort applied → Issue games float to top ✓
6. Sort applied (A-Z) → Issue games follow sort order ✓

### Knowledge Badge Tests
1. Badge clickable on desktop ✓
2. Badge clickable on mobile (touch target) ✓
3. No existing knowledge → Opens Add dialog ✓
4. Existing knowledge → Opens Edit dialog with pre-filled values ✓
5. Edit mode → "Was Taught By" hidden ✓
6. Edit mode → Delete button visible ✓
7. Click Delete → Immediate deletion + foreground toast ✓
8. No changes made → Update button disabled ✓

### Auto-Refresh Tests
1. Submit content check → Games list refreshes automatically ✓
2. Check count increments immediately ✓
3. Issue status updates in real-time ✓

---

## Deployment Plan

### Version Bump
- `lib/version.ts`: `1.19.1` → **`1.2.0`**
- `package.json`: `1.19.1` → **`1.2.0`**

### Deployment Steps

1. **Create feature branch:** `feature/v1.2.0-issues-report-rework`
2. **Database migration:** Run `scripts/add-has-issue-and-resolution-columns.js` on staging
3. **Verify migration:** Check staging database schema
4. **Build and test:** `npm run build` → Fix any TypeScript errors
5. **Commit with template:**
   ```bash
   git add .
   git commit -m "v1.2.0 - Issues/Missing Report rework and Staff UI improvements

   - Add has_issue toggle to content checks (prevents accidental reports)
   - Rename Missing Pieces Inventory → Issues/Missing Report
   - Add resolution tracking (resolved_by_id, resolved_from_check_id)
   - Resolve flow: Dialog asks if game is now Perfect Condition
   - Staff mode UI: Compress layout, hide categories, 📚 icon for checks
   - Red outline + auto-float for games with issues
   - Knowledge badge clickable → edit/delete mode
   - Fix content check auto-refresh bug
   - Add 'Has Issues' filter to games page
   - Games with issues appear in Staff Dashboard Priority Actions

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```
6. **Push to staging:** `git push origin staging`
7. **Test on staging environment:**
   - Create content check with issue toggle
   - Verify Issues/Missing Report shows game
   - Resolve issue → Verify game disappears
   - Test knowledge badge editing
   - Test mobile touch targets
8. **User approval:** Wait for "push to main" confirmation
9. **Deploy to production:** `git push origin main`

---

## Rollback Plan

If critical issues found after deployment:

1. **Database:** Columns are additive (non-breaking), no rollback needed
2. **Code:** Revert to v1.19.1 via `git revert`
3. **Data integrity:** New columns default to safe values (`has_issue=false`, resolved fields NULL)

---

## Future Enhancements (Post v1.2.0)

**Points System Integration:**
- Query `resolved_by_id` to calculate staff resolution points
- Leaderboard: "Top Issue Resolvers This Month"
- Gamification: Badges for milestones (10 issues resolved, 50 issues, etc.)

**Analytics:**
- Track most problematic games (highest issue count)
- Average time to resolution
- Staff performance metrics

**Notifications:**
- Discord webhook when high-value game has issue
- Email digest of unresolved issues to managers

---

## Success Metrics

**After v1.2.0 deployment, we should see:**
- ✅ Zero "All Good" false positives in Issues/Missing Report
- ✅ Clear resolution tracking (who fixed what, when)
- ✅ Faster staff workflows (auto-refresh, clickable badges)
- ✅ Better visual hierarchy (issue games immediately visible)
- ✅ Foundation for points system ready (structured resolution data)

---

**Design Approved:** January 1, 2025
**Implementation Start:** January 1, 2025
**Target Completion:** TBD (Big Bang deployment to staging)
