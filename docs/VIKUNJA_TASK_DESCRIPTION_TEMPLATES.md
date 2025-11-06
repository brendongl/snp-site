# Vikunja Task Description Templates

This document shows the **exact format** for all Vikunja task descriptions created through the Sip N Play website.

**Last Updated:** January 6, 2025 (v1.5.23)

---

## 1. Board Game Issues - Actionable Tasks

**Created by:** `/api/games/[id]/report-issue` endpoint
**Issue Type:** `task` (label ID: 25)
**Triggers when:** User reports an actionable issue (broken_sleeves, needs_sorting, needs_cleaning, box_rewrap, customer_reported, other_actionable)

### Description Template:

```markdown
**Issue:** [issueDescription]

**Reported by:** [reporterName]
**Game ID:** [gameId]
**Complexity:** [gameComplexity]

Complete this task to resolve the issue and earn [points] points!
```

### Example (Real):

```markdown
**Issue:** test

**Reported by:** Brendon Gan-Le
**Game ID:** rec1761482886956s3wzrndid7
**Complexity:** 1.5

Complete this task to resolve the issue and earn 500 points!
```

### Placeholders:
- `[issueDescription]` - Free text entered by staff member describing the issue
- `[reporterName]` - Staff member's full name from `staff_list.staff_name`
- `[gameId]` - Airtable record ID (e.g., `rec1761482886956s3wzrndid7`)
- `[gameComplexity]` - Game's BGG complexity rating (e.g., `1.5`, `4.0`)
- `[points]` - Calculated based on issue category and complexity:
  - Base points: 500 for most issues, 1000 for box_rewrap, 0 for customer_reported
  - Doubled if complexity >= 3.0
  - Examples: 500, 1000, 2000

### Title Format:
```
[issue_category] - [Game Name]
```

Example: `broken sleeves - Two Rooms and a Boom`

### Labels Applied:
- `task` (ID: 25) - Always applied for actionable tasks
- Point label (ID varies) - Based on calculated points:
  - 100 pts → Label ID 1
  - 200 pts → Label ID 2
  - 500 pts → Label ID 5
  - 1000 pts → Label ID 9
  - 2000 pts → Label ID 11
  - (See full mapping in `lib/services/vikunja-service.ts:getPointLabelId`)

---

## 2. Board Game Issues - Non-Actionable Notes

**Created by:** `/api/games/[id]/report-issue` endpoint
**Issue Type:** `note` (label ID: 26)
**Triggers when:** User reports a non-actionable observation (missing_pieces, broken_components, component_wear, staining, water_damage, other_observation)

### Description Template:

```markdown
**Note:** [issueDescription]

**Reported by:** [reporterName]
**Game ID:** [gameId]
**Complexity:** [gameComplexity]

This is a non-actionable observation. No points awarded upon completion.
```

### Example:

```markdown
**Note:** Missing 4 red cubes

**Reported by:** Vũ Nguyễn
**Game ID:** rec1761814858574ve8hy9oa02
**Complexity:** 3.0

This is a non-actionable observation. No points awarded upon completion.
```

### Placeholders:
- `[issueDescription]` - Free text entered by staff member describing the observation
- `[reporterName]` - Staff member's full name from `staff_list.staff_name`
- `[gameId]` - Airtable record ID
- `[gameComplexity]` - Game's BGG complexity rating

### Title Format:
```
[issue_category] - [Game Name]
```

Example: `Missing Pieces - Pandemic`

### Labels Applied:
- `note` (ID: 26) - Always applied for non-actionable notes
- **No point labels** - These tasks do not award points

---

## Task Creation Flow

```
User reports issue via Game Dialog
    ↓
POST /api/games/[id]/report-issue
    ↓
Determine issue type (actionable vs. non-actionable)
    ↓
createBoardGameIssueTask() in vikunja-service.ts
    ↓
1. Calculate points (if actionable)
2. Format description using template
3. Create task via Vikunja API (PUT /projects/25/tasks)
4. Add labels via Vikunja API (PUT /tasks/{id}/labels)
    ↓
Task appears in:
- Staff Dashboard (if actionable, label ID 25)
- Game Dialog Issues tab (all tasks)
- BG Checks & Issues page (all tasks)
```

---

## Issue Categories

### Actionable Issues (task type):
| Category | Display Name | Base Points | Description |
|----------|-------------|-------------|-------------|
| `broken_sleeves` | Broken Sleeves | 500 | Card sleeves need replacement |
| `needs_sorting` | Needs Sorting | 500 | Components need organizing |
| `needs_cleaning` | Needs Cleaning | 500 | Game needs physical cleaning |
| `box_rewrap` | Box Rewrap | 1000 | Box needs shrink wrap |
| `customer_reported` | Customer Reported | 0 | Customer complaint (triggers check) |
| `other_actionable` | Other Actionable | 500 | Something else fixable |

### Non-Actionable Observations (note type):
| Category | Display Name | Description |
|----------|-------------|-------------|
| `missing_pieces` | Missing Pieces | Components permanently missing |
| `broken_components` | Broken Components | Pieces broken beyond repair |
| `component_wear` | Component Wear | Normal wear and tear |
| `staining` | Staining | Permanent stains on components |
| `water_damage` | Water Damage | Water/moisture damage |
| `other_observation` | Other Observation | Non-fixable observation |

---

## Points Calculation

**For Actionable Tasks Only:**

```typescript
const basePoints = getIssueResolutionPoints(issueCategory);
const points = (issueType === 'task' && gameComplexity >= 3.0)
  ? basePoints * 2
  : basePoints;
```

**Examples:**
- `broken_sleeves`, complexity 1.5 → 500 points
- `broken_sleeves`, complexity 4.0 → 1000 points (doubled)
- `box_rewrap`, complexity 2.0 → 1000 points
- `box_rewrap`, complexity 3.5 → 2000 points (doubled)
- `missing_pieces` (note type) → 0 points

---

## Database Records

When a task is created, corresponding records are inserted:

### `issues` table:
```sql
INSERT INTO issues (
  game_id,
  issue_category,
  issue_description,
  reported_by,
  reported_at,
  vikunja_task_id
) VALUES (...)
```

### `changelog` table:
```sql
INSERT INTO changelog (
  event_type = 'created',
  category = 'issue_report',
  staff_id = [reportedById],
  entity_id = [gameId],
  entity_name = [gameName],
  points_awarded = 100,  -- Reporter bonus
  description = 'Reported [issueCategory] for [gameName]'
)
```

**Reporter Bonus:** All issue reports (both task and note types) award a **100 point bonus** to the reporter immediately upon submission.

---

## Code References

- **Task Creation:** [`lib/services/vikunja-service.ts:createBoardGameIssueTask`](../lib/services/vikunja-service.ts)
- **API Endpoint:** [`app/api/games/[id]/report-issue/route.ts`](../app/api/games/[id]/report-issue/route.ts)
- **Issue Dialog UI:** [`components/features/games/IssueReportDialog.tsx`](../components/features/games/IssueReportDialog.tsx)
- **Points Calculation:** [`lib/services/vikunja-service.ts:getIssueResolutionPoints`](../lib/services/vikunja-service.ts)

---

## Notes

- **Project ID:** All tasks are created in project ID **25** ("Board Game Issues")
- **Priority & Due Dates:** Removed in v1.5.22 - all tasks have equal urgency
- **Assignees:** Tasks are assigned to the Vikunja user who reported the issue
- **Label IDs:** Fixed IDs set up via `scripts/create-vikunja-point-labels.js`
- **Task vs Note:** Determined automatically based on issue category (see tables above)

---

## Changelog

**v1.5.23 (2025-01-06):**
- Added pagination fix for task retrieval (`per_page=500`)

**v1.5.22 (2025-01-06):**
- Removed priority and due dates from all tasks
- Simplified task descriptions

**v1.5.21 (2025-11-05):**
- Fixed label application using separate PUT call

**v1.5.20 (2025-11-04):**
- Shortened changelog descriptions
- Added game name to metadata

**v1.5.3 (2025-11-05):**
- Added support for task/note types with separate labels
- Split actionable vs. non-actionable issues
