# Learning Opportunities Tool Design

**Date**: January 29, 2025
**Status**: Approved
**Implementation Branch**: staging

## Overview

Add a Learning Opportunities Tool to the Staff Knowledge page that helps staff systematically plan training sessions by matching working staff with teachable games based on available time.

## Problem Statement

Staff need a way to use downtime efficiently by identifying which games can be taught given:
- Who is currently working (teacher + learner availability)
- How much time is available before customers arrive
- Which games have knowledge gaps

Currently, staff must manually:
1. Remember who knows which games
2. Estimate teaching time
3. Find games that fit the available window
4. Identify who needs to learn

This is inefficient and misses training opportunities.

## Design Goals

- Make it easy to find teaching opportunities in < 30 seconds
- Prioritize games with most learners (maximize training impact)
- Show realistic teaching time estimates (game playtime × 1.5)
- Work with existing data (no new database fields needed)
- Client-side filtering for instant results

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data fetching | Client-side filtering | 400 games + ~500 knowledge records = ~65KB, instant filtering |
| Staff tracking | Manual checkbox selection | Simple, flexible, no integration needed |
| Time calculation | Playtime × 1.5 multiplier | Realistic teaching estimate without new data fields |
| Prioritization | Most learners first | Maximize training impact per session |
| Results limit | Top 10 matches | Sufficient options without overwhelming |

## Component Design

### LearningOpportunityTool Component

**Location**: `components/features/staff/LearningOpportunityTool.tsx`

**Structure**:
```
LearningOpportunityTool
├── Staff Selector (12 checkboxes, 3 columns)
├── Time Filter (dropdown: Quick/Medium/Long)
├── Find Button (disabled until 2+ staff selected)
└── Results Display
    ├── Empty state (no matches)
    └── Opportunity cards (teacher → learners)
```

**Data Flow**:
1. Component mounts → Fetch all games + all staff knowledge records
2. User selects working staff + time tier
3. Click "Find Opportunities" → Filter in browser:
   - Filter games by: `min_playtime * 1.5 <= time_threshold`
   - For each game: Find teachers (selected staff with `can_teach=true`)
   - Find learners (selected staff with NO record OR `confidence < 2`)
   - Sort by learner count descending
4. Display top 10 matches

**Props**: None (self-contained)

**State**:
```typescript
- games: Game[] (all 400 games)
- knowledge: StaffKnowledge[] (all knowledge records)
- staffList: Staff[] (12 staff members)
- selectedStaff: string[] (stafflist_id array)
- selectedTimeTier: 'quick' | 'medium' | 'long'
- opportunities: Opportunity[] (filtered results)
- loading: boolean
```

### UI Design

**Staff Selector**:
- Checkbox grid: 3 columns desktop, 2 tablet, 1 mobile
- Display staff names from staff_list table
- All unchecked by default

**Time Filter**:
- Dropdown with 3 options:
  - Quick (0-20 min) → max teaching time: 30 min (playtime ≤ 20)
  - Medium (20-45 min) → max teaching time: 67 min (playtime ≤ 45)
  - Long (45+ min) → no max (playtime > 45)

**Find Button**:
- Disabled when < 2 staff selected
- Tooltip: "Select at least 2 staff members (1 teacher + 1 learner)"

**Results Display**:
- Opportunity cards showing:
  - Game name + original playtime + teaching estimate
  - Teacher name (only 1 teacher shown, prioritize highest confidence)
  - Learner names (comma-separated list)
  - Learner count badge
- Empty state: "No matches found. Try selecting more staff or a longer time window."

**Example Result Card**:
```
┌─────────────────────────────────────────────┐
│ Catan (30 min → ~45 min to teach)          │
│ 👨‍🏫 Teacher: Sarah                            │
│ 🎓 Can learn: John, Mike, Emma (3 learners)│
└─────────────────────────────────────────────┘
```

## Filtering Algorithm

**Step 1: Filter games by time tier**
```typescript
const timeThresholds = {
  quick: 20,  // games with min_playtime ≤ 20
  medium: 45, // games with min_playtime ≤ 45
  long: 999   // all games
};

const eligibleGames = games.filter(game =>
  game.min_playtime <= timeThresholds[selectedTimeTier]
);
```

**Step 2: For each game, find teachers and learners**
```typescript
const opportunities = eligibleGames.map(game => {
  // Find teachers: selected staff who can teach this game
  const teachers = selectedStaff.filter(staffId => {
    const knowledge = knowledgeRecords.find(k =>
      k.staff_member_id === staffId &&
      k.game_id === game.id
    );
    return knowledge?.can_teach === true;
  });

  // Find learners: selected staff with no knowledge or low confidence
  const learners = selectedStaff.filter(staffId => {
    const knowledge = knowledgeRecords.find(k =>
      k.staff_member_id === staffId &&
      k.game_id === game.id
    );
    return !knowledge || knowledge.confidence_level < 2;
  });

  return {
    game,
    teachers,
    learners,
    learnerCount: learners.length
  };
}).filter(opp =>
  opp.teachers.length > 0 && opp.learners.length > 0
);
```

**Step 3: Sort and limit**
```typescript
const sortedOpportunities = opportunities
  .sort((a, b) => b.learnerCount - a.learnerCount)
  .slice(0, 10);
```

## Data Requirements

**No new database fields needed!**

Uses existing:
- `games` table: `id`, `name`, `min_playtime`
- `staff_knowledge` table: `staff_member_id`, `game_id`, `can_teach`, `confidence_level`
- `staff_list` table: `stafflist_id`, `staff_name`

## API Integration

**Existing endpoints** (no new APIs needed):
- `GET /api/games` - Fetch all 400 games
- `GET /api/staff-knowledge` - Fetch all knowledge records
- `GET /api/staff-list` - Fetch 12 staff members

All data loaded once on component mount, filtered client-side.

## Page Integration

Add LearningOpportunityTool to existing Staff Knowledge page:

**Location**: `app/staff/knowledge/page.tsx`

**Placement**: Top of page, above existing Knowledge Gaps view

**Layout**:
```
Staff Knowledge Page
├── Learning Opportunity Tool (new, at top)
│   └── Collapsible card (expanded by default)
└── Knowledge Gaps View (existing, below)
    └── Existing functionality unchanged
```

## Mobile Responsiveness

- Staff checkboxes: 3 cols desktop → 2 cols tablet → 1 col mobile
- Result cards: Full width on all devices, stack vertically
- Teacher/learner text wraps naturally
- Time dropdown: Full width on mobile

## Empty States

**No staff selected**:
- Button disabled with tooltip

**< 2 staff selected**:
- Button disabled: "Select at least 2 staff members"

**No matches found**:
- Display message: "No matches found. Try selecting more staff or a longer time window."
- Show suggestion: "Tip: Select staff with different skill levels to find teaching opportunities"

## Error Handling

**API fetch failures**:
- Show error toast: "Failed to load data. Please refresh the page."
- Disable Find button

**Empty data**:
- If no games: Show "No games in catalog"
- If no staff: Show "No staff members found"
- If no knowledge records: All games show as teachable (no teachers exists yet)

## Success Metrics

- Tool returns results in < 100ms (client-side filtering)
- Staff can identify teaching opportunity in < 30 seconds
- Results display correctly on mobile devices
- Tool useful for daily pre-shift planning

## Technical Notes

**Teaching time calculation**:
```typescript
const teachingTime = Math.ceil(game.min_playtime * 1.5);
// Display: "30 min → ~45 min to teach"
```

**Confidence level mapping** (from existing code):
- 1: Beginner (cannot teach)
- 2: Intermediate (cannot teach)
- 3: Expert (can teach)
- 4: Instructor (can teach)

**Teacher selection priority** (when multiple teachers available):
- Show staff member with highest confidence level
- If tied, show alphabetically first name

## Future Enhancements (Out of Scope)

- "Mark as Taught" button to create knowledge records directly
- Save staff selection as "Today's Team" for quick reuse
- Show historical data: "Last taught 3 weeks ago"
- Integration with shift scheduling system
- Export training plan as PDF/calendar event
- Push notifications for optimal teaching windows
