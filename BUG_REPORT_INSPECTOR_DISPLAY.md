# Bug Report: Content Check Inspector Display Issue

**Date**: October 27, 2025
**Version**: v1.8.2
**Environment**: Staging (Railway)
**Severity**: Medium (UI Display Bug)
**Status**: Identified - Ready for Fix

---

## Summary

The Content Check History page (`/staff/check-history`) is displaying raw `inspector_id` values (e.g., `recDFEPEW1ed3rMY6`) instead of actual staff names (e.g., "Nguyễn Phước Thọ"). This bug was introduced after the recent database migration where `inspector_id` was properly backfilled but the UI query was not updated to JOIN with the `staff_list` table.

---

## Bug Evidence

### Visual Evidence
Screenshots captured during testing:
- `content-check-history-inspector-bug.png` - Shows inspector column displaying IDs instead of names

### Database Verification
Database queries confirm:
- ✅ 289 total content check records
- ✅ 106 records (36.7%) have `inspector_id` populated correctly
- ✅ 183 records (63.3%) have NULL `inspector_id` (expected for historical data)
- ✅ All 106 populated `inspector_id` values successfully JOIN with `staff_list` (0 failures)
- ✅ Staff names exist in database (e.g., "Nguyễn Phước Thọ", "Chu Đức Hoàng Phong")

**Example from database:**
| inspector_id | inspector_name |
|--------------|----------------|
| recDFEPEW1ed3rMY6 | Nguyễn Phước Thọ |
| rectCQ994k8YapcHi | Nguyễn Minh Hiếu |
| recsRa5GQlq2dJ0Rz | Chu Đức Hoàng Phong |

But UI displays: `recDFEPEW1ed3rMY6` instead of `Nguyễn Phước Thọ`

---

## Root Cause

**File**: `lib/services/content-checks-db-service.ts`
**Method**: `getAllChecksWithGameNames()` (lines 327-373)
**Line**: 358

### Current Implementation (Buggy)

```typescript
// Line 329-347: SQL Query
const result = await this.pool.query(`
  SELECT
    cc.id,
    cc.game_id,
    g.name AS game_name,
    cc.check_date,
    cc.inspector_id,     // ❌ Selecting inspector_id but not JOINing with staff_list
    cc.status,
    cc.notes,
    cc.box_condition,
    cc.card_condition,
    cc.missing_pieces,
    cc.sleeved_at_check,
    cc.box_wrapped_at_check,
    cc.is_fake
  FROM content_checks cc
  LEFT JOIN games g ON cc.game_id = g.id    // ✅ JOINs with games
  -- ❌ MISSING: LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
  ORDER BY cc.check_date DESC
`);

// Line 358: Mapping
inspector: row.inspector_id || 'Unknown Staff',  // ❌ Returns ID instead of name
```

### Why It Breaks
1. The query only JOINs with the `games` table (line 345)
2. It does NOT JOIN with the `staff_list` table
3. Line 358 directly returns `row.inspector_id` (the Airtable record ID)
4. The UI displays this raw ID instead of the staff member's name

---

## Testing Results

### ❌ FAIL: Content Check History Page
**URL**: `/staff/check-history`
- **Expected**: Display staff names (e.g., "Nguyễn Phước Thọ")
- **Actual**: Displays inspector IDs (e.g., "recDFEPEW1ed3rMY6")
- **Impact**: Users cannot identify who performed content checks

### ✅ PASS: Staff Profile Page
**URL**: `/staff/profile`
- Content check counts display correctly
- Stats are accurate (verified against database)

### ✅ PASS: Staff Directory Page
**URL**: `/staff/directory`
- Content check counts match database exactly:
  - Nguyễn Phước Thọ: 26 checks ✓
  - Nguyen Ngoc Bao Nhi: 25 checks ✓
  - Chu Đức Hoàng Phong: 19 checks ✓
  - Nguyễn Minh Hiếu: 18 checks ✓
  - Brendon Gan-Le: 9 checks ✓
  - All other staff: Correct counts ✓

### ℹ️ SKIP: Game Detail Modal
- Not tested due to page complexity
- Likely uses a different API endpoint (`/api/content-checks?gameId=...`)
- May or may not have the same bug

---

## Fix Required

### File to Fix
`lib/services/content-checks-db-service.ts` (lines 327-373)

### Required Changes

```typescript
async getAllChecksWithGameNames(): Promise<any[]> {
  try {
    const result = await this.pool.query(`
      SELECT
        cc.id,
        cc.game_id,
        g.name AS game_name,
        cc.check_date,
        cc.inspector_id,
        sl.staff_name AS inspector_name,  -- ✅ ADD THIS
        cc.status,
        cc.notes,
        cc.box_condition,
        cc.card_condition,
        cc.missing_pieces,
        cc.sleeved_at_check,
        cc.box_wrapped_at_check,
        cc.is_fake
      FROM content_checks cc
      LEFT JOIN games g ON cc.game_id = g.id
      LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id  -- ✅ ADD THIS JOIN
      ORDER BY cc.check_date DESC
    `);

    return result.rows.map((row: any) => {
      const statusString = row.status || 'Unknown';

      return {
        id: row.id,
        gameId: row.game_id,
        gameName: row.game_name || 'Unknown Game',
        checkDate: row.check_date,
        inspector: row.inspector_name || 'Unknown Staff',  // ✅ CHANGE THIS LINE
        status: statusString,
        notes: row.notes || '',
        boxCondition: row.box_condition,
        cardCondition: row.card_condition,
        missingPieces: row.missing_pieces,
        sleeved: row.sleeved_at_check,
        boxWrapped: row.box_wrapped_at_check,
        isFake: row.is_fake,
      };
    });
  } catch (error) {
    console.error('Error fetching content checks with game names:', error);
    throw error;
  }
}
```

### Changes Summary
1. **Line ~335**: Add `sl.staff_name AS inspector_name` to SELECT
2. **Line ~346**: Add `LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id`
3. **Line 358**: Change from `row.inspector_id` to `row.inspector_name`

---

## Verification Steps (After Fix)

1. Deploy fix to staging
2. Navigate to `/staff/check-history`
3. Verify recent checks (Oct 2025) show actual staff names:
   - "Nguyễn Phước Thọ" (not recDFEPEW1ed3rMY6)
   - "Chu Đức Hoàng Phong" (not recsRa5GQlq2dJ0Rz)
   - "Nguyễn Minh Hiếu" (not rectCQ994k8YapcHi)
4. Verify historical checks show "Unknown Staff" (expected for NULL inspector_id)
5. Check for console errors
6. Test sorting by staff member
7. Test filtering by staff member

---

## Additional Notes

### Data Integrity
- The database migration was successful
- All `inspector_id` values that exist are valid and link correctly
- The 183 NULL `inspector_id` records are expected (historical data before tracking was implemented)
- No data fixes are needed - this is purely a display/query bug

### No Impact On
- Staff profile statistics (uses different query)
- Staff directory counts (uses different query with proper JOIN)
- Database integrity (data is correct)

### Related Files
- `/app/staff/check-history/page.tsx` - Consumes the buggy API
- `/app/api/content-checks-detailed/route.ts` - API endpoint that calls the buggy method
- `/components/features/content-check/ContentCheckHistory.tsx` - Game modal (may need separate verification)

---

## Estimated Effort
- **Fix Time**: 5 minutes (3-line change)
- **Test Time**: 10 minutes (verify on staging)
- **Total**: 15 minutes

---

## Priority
**Medium** - This is a user-facing display bug that impacts usability but does not affect data integrity or system functionality. Users can still view content checks, but cannot easily identify who performed them.

---

**Testing Completed By**: Claude Code
**Tested On**: October 27, 2025
**Staging URL**: https://staging-production-c398.up.railway.app/
