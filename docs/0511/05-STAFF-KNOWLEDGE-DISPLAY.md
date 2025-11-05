# Phase 5: Staff Knowledge Display in Game Dialog

**Priority**: 🟡 Medium
**Effort**: Medium (1-1.5 hours)
**Dependencies**: Phase 4 (Staff Nickname System)
**Affects**: Game detail modal (both staff and public views)

---

## Problem Statement

Game dialogs should show which staff members know the game, using their nicknames.

**Requirements:**
- Show in both staff view (`?staff=true`) and normal public view
- Group expertise levels:
  - **"Staff who Know the Game"**: Beginner + Intermediate
  - **"Staff who can Teach the Game"**: Expert + Instructor
- Display nicknames (from Phase 4)
- Fetch from `staff_knowledge` table

---

## Data Source

### Database Schema

**Table**: `staff_knowledge`
```sql
CREATE TABLE staff_knowledge (
  id UUID PRIMARY KEY,
  staff_list_id UUID REFERENCES staff_list(id),
  game_record_id TEXT,
  expertise_level TEXT, -- 'beginner', 'intermediate', 'expert', 'instructor'
  confidence_level INTEGER,
  can_teach BOOLEAN,
  taught_by UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Query Pattern

```sql
SELECT
  sl.nickname,
  sl.full_name,
  sk.expertise_level,
  sk.can_teach
FROM staff_knowledge sk
JOIN staff_list sl ON sk.staff_list_id = sl.id
WHERE sk.game_record_id = $1
ORDER BY
  CASE sk.expertise_level
    WHEN 'instructor' THEN 1
    WHEN 'expert' THEN 2
    WHEN 'intermediate' THEN 3
    WHEN 'beginner' THEN 4
  END;
```

---

## API Endpoint

### Create New Endpoint

**File**: [app/api/games/[id]/staff-knowledge/route.ts](../../app/api/games/[id]/staff-knowledge/route.ts) (new)

```typescript
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;

    const result = await sql`
      SELECT
        sl.id as staff_id,
        sl.nickname,
        sl.full_name,
        sk.expertise_level,
        sk.can_teach,
        sk.confidence_level
      FROM staff_knowledge sk
      JOIN staff_list sl ON sk.staff_list_id = sl.id
      WHERE sk.game_record_id = ${gameId}
      ORDER BY
        CASE sk.expertise_level
          WHEN 'instructor' THEN 1
          WHEN 'expert' THEN 2
          WHEN 'intermediate' THEN 3
          WHEN 'beginner' THEN 4
        END;
    `;

    // Group by expertise
    const knowledge = {
      knows: result.rows.filter(
        (k) => k.expertise_level === 'beginner' || k.expertise_level === 'intermediate'
      ),
      canTeach: result.rows.filter(
        (k) => k.expertise_level === 'expert' || k.expertise_level === 'instructor'
      ),
    };

    return NextResponse.json(knowledge);
  } catch (error) {
    console.error('[API] Error fetching staff knowledge:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff knowledge' },
      { status: 500 }
    );
  }
}
```

---

## Frontend Implementation

### Files to Modify
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)

### Implementation

#### Step 1: Add State for Staff Knowledge

```tsx
const [staffKnowledge, setStaffKnowledge] = useState<{
  knows: any[];
  canTeach: any[];
}>({ knows: [], canTeach: [] });
const [loadingKnowledge, setLoadingKnowledge] = useState(false);
```

#### Step 2: Fetch Staff Knowledge

```tsx
useEffect(() => {
  if (open && game.id) {
    setLoadingKnowledge(true);
    fetch(`/api/games/${game.id}/staff-knowledge`)
      .then((res) => res.json())
      .then((data) => {
        setStaffKnowledge(data);
      })
      .catch((err) => {
        console.error('Error fetching staff knowledge:', err);
        setStaffKnowledge({ knows: [], canTeach: [] });
      })
      .finally(() => {
        setLoadingKnowledge(false);
      });
  }
}, [open, game.id]);
```

#### Step 3: Display Staff Knowledge Section

Add this section in the game dialog, after game details but before actions:

```tsx
{/* Staff Knowledge Section */}
<div className="border-t pt-4 mt-4">
  <h3 className="font-semibold mb-3 flex items-center gap-2">
    <Users className="h-4 w-4" />
    Staff Knowledge
  </h3>

  {loadingKnowledge ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading staff knowledge...
    </div>
  ) : (
    <div className="space-y-3">
      {/* Staff who can teach */}
      {staffKnowledge.canTeach.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <h4 className="text-sm font-medium text-green-900 mb-2 flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Can Teach This Game
          </h4>
          <div className="flex flex-wrap gap-2">
            {staffKnowledge.canTeach.map((staff) => (
              <span
                key={staff.staff_id}
                className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded"
              >
                {staff.nickname || staff.full_name}
                {staff.expertise_level === 'instructor' && ' ⭐'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Staff who know the game */}
      {staffKnowledge.knows.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knows This Game
          </h4>
          <div className="flex flex-wrap gap-2">
            {staffKnowledge.knows.map((staff) => (
              <span
                key={staff.staff_id}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
              >
                {staff.nickname || staff.full_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No knowledge recorded */}
      {staffKnowledge.knows.length === 0 && staffKnowledge.canTeach.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No staff knowledge recorded for this game yet.
        </p>
      )}
    </div>
  )}
</div>
```

#### Step 4: Import Required Icons

```tsx
import {
  Users,
  GraduationCap,
  BookOpen,
  Loader2,
  // ... other icons
} from 'lucide-react';
```

---

## Alternative: Compact Display

If the above takes too much space, use a compact version:

```tsx
<div className="border-t pt-4 mt-4">
  <h3 className="text-sm font-medium mb-2">Staff Knowledge</h3>

  <div className="space-y-2 text-sm">
    {/* Can teach */}
    {staffKnowledge.canTeach.length > 0 && (
      <div>
        <span className="text-muted-foreground">Can teach: </span>
        <span className="font-medium">
          {staffKnowledge.canTeach.map((s) => s.nickname || s.full_name).join(', ')}
        </span>
      </div>
    )}

    {/* Knows */}
    {staffKnowledge.knows.length > 0 && (
      <div>
        <span className="text-muted-foreground">Knows: </span>
        <span>
          {staffKnowledge.knows.map((s) => s.nickname || s.full_name).join(', ')}
        </span>
      </div>
    )}

    {/* No knowledge */}
    {staffKnowledge.knows.length === 0 && staffKnowledge.canTeach.length === 0 && (
      <p className="text-muted-foreground italic">No staff knowledge recorded.</p>
    )}
  </div>
</div>
```

---

## Implementation Steps

### Step 1: Create API Endpoint
1. Create [app/api/games/[id]/staff-knowledge/route.ts](../../app/api/games/[id]/staff-knowledge/route.ts)
2. Implement query with staff_list JOIN
3. Group by expertise level
4. Test endpoint locally:
   ```bash
   curl http://localhost:3000/api/games/recXXXXXXXXXXX/staff-knowledge
   ```

### Step 2: Update GameDetailModal
1. Open [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)
2. Add state for staff knowledge
3. Add useEffect to fetch data
4. Add staff knowledge section to dialog
5. Import required icons

### Step 3: Test Both Views
1. Test in staff view (`?staff=true`)
   - Verify staff knowledge displays
   - Verify nicknames used
2. Test in public view (no `?staff=true`)
   - Verify staff knowledge displays
   - Verify no auth required

### Step 4: Test Edge Cases
1. Game with no staff knowledge
2. Game with only "knows" staff
3. Game with only "can teach" staff
4. Game with both groups
5. Verify loading state appears

### Step 5: Commit and Deploy
```bash
git add .
git commit -m "v1.5.6 - Display staff knowledge in game dialog

- Add staff knowledge API endpoint
- Show staff who know vs can teach the game
- Display in both staff and public views
- Use nicknames from Phase 4

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

### API Endpoint
- [ ] Endpoint created at `/api/games/[id]/staff-knowledge`
- [ ] Returns correct data structure
- [ ] Joins staff_list for nicknames
- [ ] Groups expertise levels correctly
- [ ] Handles games with no knowledge

### Frontend Display
- [ ] Staff knowledge section added to game dialog
- [ ] "Can teach" group displays correctly
- [ ] "Knows" group displays correctly
- [ ] Nicknames display (not full names)
- [ ] Instructor star icon shows for instructors
- [ ] Loading state displays
- [ ] Empty state displays when no knowledge

### Both Views
- [ ] Works in staff view (`?staff=true`)
- [ ] Works in public view (no auth)
- [ ] No console errors
- [ ] Mobile responsive

---

## Rollback Plan

If issues arise:
1. Remove staff knowledge section from GameDetailModal
2. Delete API endpoint
3. Redeploy previous version

---

## Estimated Timeline

- **API Endpoint**: 20 minutes
- **Frontend Implementation**: 40 minutes
- **Testing**: 20 minutes
- **Deployment**: 10 minutes
- **Total**: ~1.5 hours

---

## Related Files

### New Files
- [app/api/games/[id]/staff-knowledge/route.ts](../../app/api/games/[id]/staff-knowledge/route.ts)

### Modified Files
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)

### Related Services
- [lib/services/staff-knowledge-db-service.ts](../../lib/services/staff-knowledge-db-service.ts) (reference)

---

## Notes

- Staff knowledge is visible to all users (not just staff)
- This helps customers know which staff to ask for help
- Consider adding "Add Knowledge" button for staff view (future enhancement)
- Instructor star emoji (⭐) distinguishes top-level teachers
- Compact display option available if space is limited
