# Staff Pages Enhancement Design

**Date**: October 28, 2025
**Status**: Approved
**Implementation Branch**: main

## Overview

This design enhances the three staff-facing pages (Check History, Play Logs, Staff Knowledge) to make them more useful and easier to navigate. The solution introduces a new Staff Dashboard as an overview page while keeping detailed pages for focused work.

## Problem Statement

Current staff pages have usability issues:

1. **Check History**: Hard to identify which games need checking, no easy way to handle found pieces, can't edit/delete own records
2. **Play Logs**: Missing basic statistics and insights
3. **Staff Knowledge**: Knowledge gaps not prominent, learning opportunities lack context (who's working, available time)

## Design Goals

- Make it easy to identify games needing content checks
- Provide scannable list of missing pieces for quick matching
- Show play log statistics with flexible time periods
- Enable systematic learning opportunities based on staff availability and time
- Allow staff to manage their own records (edit/delete)

## Architecture Approach

**Dashboard as overview + keep detail pages**

- New `/staff/dashboard` page shows key metrics and quick actions
- Existing detail pages (`/staff/check-history`, `/staff/play-logs`, `/staff/knowledge`) enhanced for deep work
- Dashboard provides overview, individual pages provide detail and management tools

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Check priority criteria | Time-based (X days since check) | Consistent maintenance schedule |
| Piece recovery workflow | Create 'piece found' check entry | Maintains audit trail |
| Staff tracking | Staff list selector before each session | Flexible, no integration needed |
| Time filtering | Tiered categories (Quick/Medium/Long) | Easy to scan, sufficient granularity |
| Stats timeframe | Dropdown with 7/30/90 days | Covers short to long-term trends |

## Detailed Design

### 1. Staff Dashboard (`/staff/dashboard`)

**Purpose**: Mission control with key metrics and quick actions

```
┌─────────────────────────────────────────────────────┐
│  Staff Dashboard                            [Name ▼]│
├─────────────────────────────────────────────────────┤
│  📊 Quick Stats (3 cards)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Games Need│ │Play Logs  │ │Learning  │           │
│  │Checking: │ │Today: 12  │ │Gaps: 8   │           │
│  │   15     │ │This Week:│ │Ready: 3  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────┤
│  🎯 Priority Actions                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ • Check "Catan" (45 days, 12 plays)    [→] │   │
│  │ • Check "Wingspan" (40 days, 8 plays)  [→] │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  🎓 Learning Opportunity Tool                       │
│  [Staff Selector] [Time: 30min ▼]  [Find Games]   │
├─────────────────────────────────────────────────────┤
│  📝 Recent Activity (last 10 items)                │
│  • John checked "Azul" - 2 hours ago               │
│  • Sarah logged play: "Ticket to Ride" - 3h ago    │
└─────────────────────────────────────────────────────┘
```

**Key Features**:
- Quick stats cards show urgent items at a glance
- Priority actions list top games needing checks (sorted by days overdue)
- Learning opportunity tool embedded for quick access
- Recent activity stream shows team activity

**Navigation**:
- Links to detailed pages in main menu
- Action buttons ([→]) navigate to specific game/check

---

### 2. Check History Page (`/staff/check-history`)

**Purpose**: Manage content checks and missing pieces

#### View Modes

**Needs Checking View** (default):
```
┌─────────────────────────────────────────────────────┐
│  Content Check History                              │
├─────────────────────────────────────────────────────┤
│  📋 View Mode: [Needs Checking] [All Checks] [Missing Pieces] │
├─────────────────────────────────────────────────────┤
│  Filters:                                           │
│  Days threshold: [30▼] [Apply]  Sort: [Days▼]      │
│                                                      │
│  📊 15 games need checking                          │
│  ┌─────────────────────────────────────────────┐   │
│  │ Catan                                       │   │
│  │ Last checked: 45 days ago                   │   │
│  │ Plays since check: 12                       │   │
│  │ [Check Now] [View History]                  │   │
│  ├─────────────────────────────────────────────┤   │
│  │ Wingspan                                    │   │
│  │ Last checked: 40 days ago                   │   │
│  │ Plays since check: 8                        │   │
│  │ [Check Now] [View History]                  │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  Missing Pieces List (Summary):                     │
│  5 games with missing pieces → [View All]          │
└─────────────────────────────────────────────────────┘
```

**Missing Pieces View**:
```
┌─────────────────────────────────────────────────────┐
│  🔍 Missing Pieces Inventory                        │
├─────────────────────────────────────────────────────┤
│  Search: [________] Sort: [Alphabetical ▼]         │
│                                                      │
│  📦 27 missing pieces across 5 games                │
│  ┌─────────────────────────────────────────────┐   │
│  │ ▶ 3 blue tiles                              │   │
│  │ ▶ 1 destination card                        │   │
│  │ ▶ 1 green meeple                            │   │
│  │ ▶ 2 red trains                              │   │
│  │ ▶ 5 resource cubes (brown)                  │   │
│  │ ▶ 1 six-sided die                           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Expanded piece view**:
```
┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────┐   │
│  │ ▼ 2 red trains                              │   │
│  │   ┌───────────────────────────────────────┐ │   │
│  │   │ Game: Ticket to Ride                  │ │   │
│  │   │ Reported: 2024-10-15 by Sarah         │ │   │
│  │   │ Note: Missing from box after busy day │ │   │
│  │   │                                        │ │   │
│  │   │ [Mark Found] [View Game] [Add Note]   │ │   │
│  │   └───────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Features**:
- **Needs Checking**: Time-based filtering (configurable threshold: 7/14/30/60 days)
- **Missing Pieces**: Collapsed list of ALL missing pieces for easy scanning
- **Piece Recovery**: "Mark Found" creates new check entry with type `piece_recovery`
- **Record Management**: Staff can edit/delete their own check records
- **Search**: Filter missing pieces by keyword

**Data Requirements**:
- Query: Games where `last_checked_date` is NULL or older than threshold
- Join with `play_logs` to show "plays since check"
- Query: All content checks with `missing_pieces` field not empty
- Parse and flatten missing pieces into scannable list

---

### 3. Play Logs Page (`/staff/play-logs`)

**Purpose**: View play session logs with statistics

```
┌─────────────────────────────────────────────────────┐
│  Play Logs                                          │
├─────────────────────────────────────────────────────┤
│  📊 Statistics                                      │
│  Time period: [Last 7 days ▼] [Last 30 days] [Last 90 days] │
│                                                      │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐          │
│  │Unique │ │ Total │ │ Most  │ │  Top  │          │
│  │Games  │ │ Plays │ │Played │ │Logger │          │
│  │  24   │ │  156  │ │ Catan │ │ Sarah │          │
│  │       │ │       │ │(12x)  │ │(23x)  │          │
│  └───────┘ └───────┘ └───────┘ └───────┘          │
├─────────────────────────────────────────────────────┤
│  📝 Recent Logs                                     │
│  Filters: [All Staff ▼] [All Games ▼] [Date Range] │
│                                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │ Catan                                       │   │
│  │ Logged by: Sarah • 2 hours ago              │   │
│  │ [Edit] [Delete]                             │   │
│  ├─────────────────────────────────────────────┤   │
│  │ Wingspan                                    │   │
│  │ Logged by: John • 3 hours ago               │   │
│  │ [Edit] [Delete]                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  [Log New Play Session]                            │
└─────────────────────────────────────────────────────┘
```

**Key Features**:
- **Statistics Cards**: 4 metrics in single row (responsive to mobile stack)
- **Time Period Selector**: Dropdown with 7/30/90 day options
- **Filters**: By staff member, game, or date range
- **Record Management**: Edit/delete own logs

**Statistics Calculations**:
- **Unique Games**: `COUNT(DISTINCT game_id)` in time period
- **Total Plays**: `COUNT(*)` in time period
- **Most Played**: `game_id` with highest count, show count
- **Top Logger**: `staff_member` with highest log count, show count

**Responsive Design**:
- Desktop: 4 cards in row (25% width each)
- Mobile: Cards stack vertically (100% width)
- CSS: `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`
- No horizontal overflow

---

### 4. Staff Knowledge Page (`/staff/knowledge`)

**Purpose**: Manage expertise and facilitate learning opportunities

```
┌─────────────────────────────────────────────────────┐
│  Staff Knowledge                                    │
├─────────────────────────────────────────────────────┤
│  🎓 Learning Opportunity Tool                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Working Staff: [☐ Sarah] [☐ John] [☐ Mike] │   │
│  │               [☐ Emma] [☐ Lisa] [☐ Tom]    │   │
│  │                                              │   │
│  │ Available Time: [Quick (0-20min) ▼]        │   │
│  │                 [Medium (20-45min)]         │   │
│  │                 [Long (45+ min)]            │   │
│  │                                              │   │
│  │ [Find Learning Opportunities]               │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  💡 Recommended Sessions (after tool run):          │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ Catan (30 min) - Quick Session           │   │
│  │ Teacher: Sarah → Student: John              │   │
│  │ Gap: John never learned this game           │   │
│  │ [Mark as Taught]                            │   │
│  ├─────────────────────────────────────────────┤   │
│  │ ✅ Wingspan (45 min) - Medium Session       │   │
│  │ Teacher: Mike → Students: Emma, Lisa        │   │
│  │ Gap: Emma & Lisa never learned this         │   │
│  │ [Mark as Taught]                            │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  📊 Knowledge Matrix                                │
│  View: [Knowledge Gaps ▼] [All Staff] [By Game]   │
│                                                      │
│  🔴 Knowledge Gaps (23 games need teaching)        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Catan                                       │   │
│  │ Can teach: Sarah (★★★), Mike (★★)         │   │
│  │ Need to learn: John, Emma, Lisa            │   │
│  │ Playtime: 30 min                           │   │
│  ├─────────────────────────────────────────────┤   │
│  │ Wingspan                                    │   │
│  │ Can teach: Mike (★★★)                      │   │
│  │ Need to learn: Sarah, John, Emma, Lisa     │   │
│  │ Playtime: 45 min                           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Key Features**:
- **Learning Opportunity Tool**: Select working staff + available time → find matching games
- **Recommended Sessions**: Shows teacher → student pairings with game details
- **Knowledge Gaps View**: Highlights games needing teaching (default view)
- **Mark as Taught**: Creates knowledge record for student(s) automatically

**Learning Opportunity Algorithm**:
1. Filter games by selected time tier:
   - Quick: `min_playtime <= 20`
   - Medium: `min_playtime > 20 AND min_playtime <= 45`
   - Long: `min_playtime > 45`
2. Find games where:
   - At least 1 selected staff has `can_teach = true` AND `confidence >= 3`
   - At least 1 selected staff has no knowledge record OR `confidence < 2`
3. Rank by number of potential students (more learners = higher priority)
4. Return top 10 opportunities

**Knowledge Gap Logic**:
- Query all games in catalog
- Join with staff_knowledge table
- For each game: count staff who can teach vs need to learn
- Sort by most learners first (biggest training opportunity)

**Time Tier Thresholds**:
- Quick: 0-20 minutes
- Medium: 20-45 minutes
- Long: 45+ minutes
- Use `min_playtime` from games table

---

## Database Schema Changes

### New Fields Required

**`content_checks` table**:
- Add `check_type` VARCHAR(50) - values: `regular`, `piece_recovery`
- Allows distinguishing piece recovery checks from regular inspections

**`games` table**:
- No changes needed (already has `min_playtime`)

**`staff_knowledge` table**:
- No changes needed (has `can_teach`, `confidence`)

**`play_logs` table**:
- No changes needed

### New Queries Needed

**Check History - Needs Checking**:
```sql
SELECT g.id, g.name,
       MAX(cc.checked_at) as last_checked_date,
       COUNT(pl.id) as plays_since_check
FROM games g
LEFT JOIN content_checks cc ON g.id = cc.game_id
LEFT JOIN play_logs pl ON g.id = pl.game_id
  AND pl.created_at > COALESCE(MAX(cc.checked_at), '1970-01-01')
WHERE MAX(cc.checked_at) IS NULL
   OR MAX(cc.checked_at) < NOW() - INTERVAL '30 days'
GROUP BY g.id, g.name
ORDER BY last_checked_date ASC NULLS FIRST;
```

**Missing Pieces Inventory**:
```sql
SELECT cc.id, cc.game_id, cc.missing_pieces,
       cc.notes, cc.checked_by, cc.checked_at,
       g.name as game_name
FROM content_checks cc
JOIN games g ON cc.game_id = g.id
WHERE cc.missing_pieces IS NOT NULL
  AND cc.missing_pieces != ''
ORDER BY cc.checked_at DESC;
```

**Play Logs Statistics**:
```sql
-- Unique games
SELECT COUNT(DISTINCT game_id) FROM play_logs
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Total plays
SELECT COUNT(*) FROM play_logs
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Most played game
SELECT game_id, COUNT(*) as play_count
FROM play_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY game_id
ORDER BY play_count DESC
LIMIT 1;

-- Top logger
SELECT staff_member, COUNT(*) as log_count
FROM play_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY staff_member
ORDER BY log_count DESC
LIMIT 1;
```

**Learning Opportunities**:
```sql
SELECT g.id, g.name, g.min_playtime,
       STRING_AGG(DISTINCT sk_teachers.staff_name, ', ') as teachers,
       STRING_AGG(DISTINCT sk_learners.staff_name, ', ') as learners,
       COUNT(DISTINCT sk_learners.staff_id) as learner_count
FROM games g
JOIN staff_knowledge sk_teachers
  ON g.id = sk_teachers.game_id
  AND sk_teachers.can_teach = true
  AND sk_teachers.confidence >= 3
  AND sk_teachers.staff_id IN (/* selected working staff */)
LEFT JOIN staff s ON s.id NOT IN (
  SELECT staff_id FROM staff_knowledge
  WHERE game_id = g.id AND confidence >= 2
)
JOIN staff sk_learners ON sk_learners.id = s.id
  AND sk_learners.id IN (/* selected working staff */)
WHERE g.min_playtime <= /* time threshold based on tier */
GROUP BY g.id, g.name, g.min_playtime
HAVING COUNT(DISTINCT sk_learners.staff_id) > 0
ORDER BY learner_count DESC
LIMIT 10;
```

---

## Component Structure

### New Components

**`StaffDashboard.tsx`**:
- Location: `app/staff/dashboard/page.tsx`
- Contains: Quick stats cards, priority actions, learning tool, activity feed

**`QuickStatsCards.tsx`**:
- Location: `components/features/staff/QuickStatsCards.tsx`
- Reusable stat cards (used in dashboard and individual pages)

**`MissingPiecesInventory.tsx`**:
- Location: `components/features/content-check/MissingPiecesInventory.tsx`
- Collapsible list of missing pieces with expand/collapse

**`LearningOpportunityTool.tsx`**:
- Location: `components/features/staff/LearningOpportunityTool.tsx`
- Staff selector + time tier + find button + results

**`PlayLogStats.tsx`**:
- Location: `components/features/staff/PlayLogStats.tsx`
- 4-card statistics display with time period selector

### Modified Components

**`ContentCheckHistory.tsx`**:
- Add view mode tabs (Needs Checking / All Checks / Missing Pieces)
- Add filters for days threshold
- Add edit/delete buttons for own records

**`StaffKnowledge.tsx`**:
- Add Learning Opportunity Tool at top
- Add Knowledge Gaps view (make default)
- Enhance gap display with teacher/learner breakdown

---

## API Endpoints

### New Endpoints

**`GET /api/staff/dashboard/stats`**:
- Returns quick stats for dashboard cards
- Response: `{ gamesNeedingCheck: number, playLogsToday: number, playLogsThisWeek: number, knowledgeGaps: number, learningOpportunitiesReady: number }`

**`GET /api/staff/dashboard/priority-actions`**:
- Returns top 5 games needing checks
- Query params: `limit` (default: 5)
- Response: `{ game_id, name, days_since_check, plays_since_check }[]`

**`GET /api/content-checks/needs-checking`**:
- Returns games needing checks based on time threshold
- Query params: `daysThreshold` (default: 30)
- Response: `{ game_id, name, last_checked_date, plays_since_check }[]`

**`GET /api/content-checks/missing-pieces`**:
- Returns flattened list of all missing pieces
- Response: `{ piece_description, game_id, game_name, check_id, reported_by, reported_date, notes }[]`

**`POST /api/content-checks/mark-piece-found`**:
- Creates new content check with type `piece_recovery`
- Body: `{ check_id, pieces_found: string[], notes: string }`
- Response: `{ success: boolean, new_check_id: number }`

**`GET /api/play-logs/stats`**:
- Returns statistics for play logs
- Query params: `timePeriod` (7, 30, or 90 days)
- Response: `{ uniqueGames, totalPlays, mostPlayed: { game_name, count }, topLogger: { staff_name, count } }`

**`POST /api/staff-knowledge/learning-opportunities`**:
- Finds learning opportunities based on working staff and time
- Body: `{ workingStaff: string[], timeTier: 'quick' | 'medium' | 'long' }`
- Response: `{ game_id, game_name, playtime, teachers: string[], learners: string[], learner_count }[]`

**`GET /api/staff-knowledge/gaps`**:
- Returns knowledge gaps (games with teaching needs)
- Response: `{ game_id, game_name, playtime, teachers: { name, confidence }[], learners: string[] }[]`

### Modified Endpoints

**`DELETE /api/content-checks/[id]`**:
- Add authorization check: only allow staff member who created it
- Response: `{ success: boolean }`

**`PATCH /api/content-checks/[id]`**:
- Add authorization check: only allow staff member who created it
- Body: `{ notes?, missing_pieces? }`
- Response: `{ success: boolean }`

---

## UI/UX Considerations

### Mobile Responsiveness

- **Dashboard**: Stack all cards vertically on mobile
- **Statistics Cards**: Use CSS Grid with `auto-fit` to wrap naturally
- **Missing Pieces**: Full-width expandable items
- **Learning Tool**: Stack checkboxes vertically, full-width buttons

### Loading States

- Show skeleton loaders for statistics cards while fetching
- Display "Finding opportunities..." spinner when tool runs
- Use optimistic UI updates for "Mark as Taught" actions

### Empty States

- **No games need checking**: Show success message with checkmark
- **No missing pieces**: "All pieces accounted for!" message
- **No learning opportunities**: "No matches found - try different staff or time tier"
- **No play logs**: "No games logged yet" with CTA button

### Error Handling

- Display error toasts for failed API calls
- Graceful degradation: show cached data if available
- Retry buttons for failed statistics loads

### Accessibility

- All interactive elements keyboard accessible
- Proper ARIA labels for stat cards
- Focus management for expanded missing pieces
- Screen reader announcements for dynamic updates

---

## Implementation Phases

### Phase 1: Dashboard Foundation
- Create `/staff/dashboard` route
- Build QuickStatsCards component
- Implement basic stats API endpoint
- Wire up navigation links

### Phase 2: Check History Enhancements
- Add view mode tabs
- Implement "Needs Checking" view with filters
- Build Missing Pieces Inventory component
- Add piece recovery workflow
- Implement edit/delete for own records

### Phase 3: Play Logs Statistics
- Build PlayLogStats component
- Implement statistics calculations API
- Add time period selector
- Wire up responsive grid layout

### Phase 4: Learning Opportunities
- Build LearningOpportunityTool component
- Implement matching algorithm API
- Add "Mark as Taught" workflow
- Enhance Knowledge Gaps view

### Phase 5: Polish & Testing
- Mobile responsiveness testing
- Loading states and error handling
- Empty states and accessibility
- Performance optimization

---

## Success Metrics

- **Check History**: Staff can identify games needing checks in < 10 seconds
- **Missing Pieces**: Staff can scan and match found pieces in < 30 seconds
- **Play Logs**: Statistics load in < 2 seconds
- **Learning Opportunities**: Tool returns results in < 3 seconds
- **Mobile**: All features fully functional on mobile devices

---

## Future Enhancements (Out of Scope)

- Push notifications for games needing urgent checks
- Calendar integration for scheduled learning sessions
- Advanced analytics dashboard with charts/graphs
- Bulk operations (check multiple games at once)
- Staff scheduling system integration
- Photo upload for found pieces verification
