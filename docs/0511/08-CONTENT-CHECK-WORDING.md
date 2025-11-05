# Phase 8: Content Check Wording Updates

**Priority**: 🟢 Low
**Effort**: Small (15-20 minutes)
**Dependencies**: None
**Affects**: Content check dialog text

---

## Issue Addressed

### Issue #6: Reword Content Check Labels

**Current wording:**
- "sleeved at check"
- "box wrapped at check"

**New wording:**
- "All cards are Sleeved"
- "Box is wrapped"

---

## Files to Modify

- [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)

---

## Implementation

### Step 1: Update Content Check Dialog

**Find and replace text:**

```tsx
{/* OLD */}
<label htmlFor="sleeved">
  <input
    type="checkbox"
    id="sleeved"
    checked={sleevedAtCheck}
    onChange={(e) => setSleevedAtCheck(e.target.checked)}
  />
  Sleeved at check
</label>

{/* NEW */}
<label htmlFor="sleeved" className="flex items-center gap-2">
  <input
    type="checkbox"
    id="sleeved"
    checked={sleevedAtCheck}
    onChange={(e) => setSleevedAtCheck(e.target.checked)}
    className="h-4 w-4"
  />
  <span>All cards are Sleeved</span>
</label>

{/* OLD */}
<label htmlFor="wrapped">
  <input
    type="checkbox"
    id="wrapped"
    checked={boxWrappedAtCheck}
    onChange={(e) => setBoxWrappedAtCheck(e.target.checked)}
  />
  Box wrapped at check
</label>

{/* NEW */}
<label htmlFor="wrapped" className="flex items-center gap-2">
  <input
    type="checkbox"
    id="wrapped"
    checked={boxWrappedAtCheck}
    onChange={(e) => setBoxWrappedAtCheck(e.target.checked)}
    className="h-4 w-4"
  />
  <span>Box is wrapped</span>
</label>
```

### Alternative: Using shadcn Checkbox Component

If using shadcn UI components:

```tsx
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// In the form
<div className="flex items-center space-x-2">
  <Checkbox
    id="sleeved"
    checked={sleevedAtCheck}
    onCheckedChange={setSleevedAtCheck}
  />
  <Label htmlFor="sleeved" className="text-sm font-normal cursor-pointer">
    All cards are Sleeved
  </Label>
</div>

<div className="flex items-center space-x-2">
  <Checkbox
    id="wrapped"
    checked={boxWrappedAtCheck}
    onCheckedChange={setBoxWrappedAtCheck}
  />
  <Label htmlFor="wrapped" className="text-sm font-normal cursor-pointer">
    Box is wrapped
  </Label>
</div>
```

---

## Implementation Steps

### Step 1: Locate Content Check Dialog
1. Open [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)

### Step 2: Find Checkbox Labels
1. Search for "sleeved at check"
2. Search for "box wrapped at check"

### Step 3: Replace Text
1. Replace "Sleeved at check" with "All cards are Sleeved"
2. Replace "Box wrapped at check" with "Box is wrapped"
3. Optionally improve checkbox styling

### Step 4: Test
1. Open content check dialog
2. Verify new wording displays
3. Verify checkboxes still work
4. Test on mobile devices

### Step 5: Commit and Deploy
```bash
git add components/features/content-check/ContentCheckDialog.tsx
git commit -m "v1.5.6 - Update content check wording

- Change 'sleeved at check' to 'All cards are Sleeved'
- Change 'box wrapped at check' to 'Box is wrapped'

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

- [ ] Content check dialog opens
- [ ] "All cards are Sleeved" displays correctly
- [ ] "Box is wrapped" displays correctly
- [ ] Checkboxes functional
- [ ] Text readable on mobile
- [ ] No console errors

---

## Rollback Plan

Simple text change - revert commit if issues arise.

---

## Estimated Timeline

- **Implementation**: 5 minutes
- **Testing**: 5 minutes
- **Deployment**: 5 minutes
- **Total**: ~15 minutes

---

## Related Files

- [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)

---

## Notes

- Simple text change, low risk
- Consider adding tooltips to explain what "sleeved" and "wrapped" mean (future enhancement)
- No database changes needed (database columns unchanged)
- This is a UI-only change
