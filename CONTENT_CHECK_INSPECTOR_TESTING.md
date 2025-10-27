# Content Check Inspector Display - Testing Instructions

## Context
We've backfilled missing inspector_id data in the content_checks table and removed the redundant staff_list_id column. The database changes are already applied to staging. Now we need to verify the UI displays inspector names correctly.

**Version**: v1.8.2
**Date**: October 27, 2025
**Database**: Staging PostgreSQL (Railway)

## Database State (Staging)
- **289 total content check records**
- **106 records (36.7%)** have inspector_id populated
- **183 records (63.3%)** have NULL inspector_id (historical data)
- **All inspector_id values correctly link** to staff_list.stafflist_id (0 JOIN failures)

## Expected Behavior
- **Records WITH inspector_id**: Should display actual staff name (e.g., "Nguyễn Phước Thọ", "Brendon Gan-Le")
- **Records WITHOUT inspector_id**: Should display "Unknown Staff" (this is correct for historical data)

---

## Testing Checklist

### 1. Content Check History Page
**URL**: `/staff/check-history`
**Login Required**: Yes (staff mode)

**Test Steps**:
1. Navigate to Content Check History page
2. Verify inspector column displays staff names (not "Unknown Staff" for all records)
3. Check that ~37% of records show actual names, ~63% show "Unknown Staff"
4. Verify no console errors related to inspector_id

**Expected Results**:
- ✅ Recent checks (Oct 2025) should show inspector names
- ✅ Older checks may show "Unknown Staff" (expected)
- ✅ No "undefined" or broken display
- ✅ No console errors

### 2. Staff Profile Page
**URL**: `/staff/profile?staffMemberId={stafflist_id}`
**Example**: `/staff/profile?staffMemberId=recLADJrJHuFprhOd` (Brendon)

**Test Steps**:
1. Navigate to any staff profile
2. Check "Content Checks" stats in KnowledgeStats component
3. Verify content check count displays correctly
4. Click through to see individual check records

**Expected Results**:
- ✅ Content check count shows correct number
- ✅ Individual checks display with proper inspector names
- ✅ Stats update when filtering by date/game

### 3. Staff Directory Page
**URL**: `/staff/directory`

**Test Steps**:
1. Navigate to Staff Directory
2. Check each staff member's stats card
3. Verify "Content Checks" count is accurate
4. Compare with database counts if possible

**Expected Results**:
- ✅ Each staff member shows correct check count
- ✅ No errors in console
- ✅ Stats update properly when filtering

### 4. Game Detail Modal (Content Check History)
**URL**: `/games` → Click any game → "Check History" tab

**Test Steps**:
1. Open games catalog page
2. Click on a game that has been content-checked (try: "Abracada...What?", "In a Grove", "Skyjo")
3. Go to "Check History" tab in the modal
4. Verify inspector names display correctly

**Expected Results**:
- ✅ Check history shows inspector names
- ✅ Historical checks may show "Unknown Staff"
- ✅ Recent checks show actual names

### 5. Add Content Check Dialog
**URL**: Staff mode → Click "Add Check" on game card

**Test Steps**:
1. Enable staff mode (`?staff=true`)
2. Try to add a new content check
3. Verify inspector is auto-selected (based on logged-in staff)
4. Submit the check and verify it saves with inspector_id

**Expected Results**:
- ✅ Inspector field is pre-filled
- ✅ New check saves successfully
- ✅ Appears in history with correct inspector name

---

## Database Verification Queries

If you have database access, run these queries to verify data:

### Check overall inspector_id population
```sql
SELECT
  COUNT(*) as total,
  COUNT(inspector_id) as with_inspector,
  COUNT(*) - COUNT(inspector_id) as without_inspector
FROM content_checks;
```
**Expected**: 289 total, 106 with inspector, 183 without

### Verify JOIN works (should have 0 failures)
```sql
SELECT
  COUNT(*) FILTER (WHERE cc.inspector_id IS NOT NULL) as total_with_inspector,
  COUNT(sl.stafflist_id) as successful_joins,
  COUNT(*) FILTER (WHERE cc.inspector_id IS NOT NULL AND sl.stafflist_id IS NULL) as failed_joins
FROM content_checks cc
LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id;
```
**Expected**: 106 total_with_inspector, 106 successful_joins, 0 failed_joins

### Show recent checks with inspector names
```sql
SELECT
  cc.check_date,
  g.name as game_name,
  sl.staff_name as inspector_name
FROM content_checks cc
LEFT JOIN games g ON cc.game_id = g.id
LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
WHERE cc.check_date > '2025-09-01'
ORDER BY cc.check_date DESC
LIMIT 20;
```
**Expected**: All recent checks should have inspector_name populated

---

## Known Issues & Expected Behavior

### Expected NULL Values
- **183 records have NULL inspector_id** (63.3%)
- These are historical records from before inspector tracking was implemented
- They **SHOULD** display "Unknown Staff" - this is correct, not a bug

### Successful Backfill
- **106 records now have inspector_id** (36.7%)
- All 106 correctly link to staff records (0 JOIN failures)
- Recent checks (Oct 2025) should all have inspector names

---

## Success Criteria

### ✅ PASS if:
- Content Check History shows mix of staff names and "Unknown Staff"
- No console errors related to inspector_id
- Recent checks display actual inspector names
- Staff profiles show correct check counts
- New checks save with inspector_id populated

### ❌ FAIL if:
- All records show "Unknown Staff"
- Console errors about missing fields
- JOIN failures in database queries
- New checks don't save inspector_id

---

## Rollback Plan (If Needed)

**IMPORTANT**: The `staff_list_id` column has been dropped from the database. If there are critical issues:

1. **DO NOT** attempt to rollback the database migration (column cannot be restored without manual intervention)
2. The inspector_id data is safe and correct
3. Contact Brendon before any rollback attempts
4. The issue is likely in UI display logic, not data

---

## Additional Notes

- The database migration scripts have **ALREADY been run** on staging
- No re-running of migration scripts is needed
- This is **purely a UI verification test**
- The data is correct in the database; we're just verifying it displays properly
- The staging environment should auto-deploy from the `staging` branch within a few minutes

---

## Quick Verification Script

If you want to quickly verify the database state, run this one-liner:

```bash
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway', ssl: false }); pool.query('SELECT COUNT(*) as total, COUNT(inspector_id) as with_inspector FROM content_checks').then(r => { console.log('Content Checks:', r.rows[0]); pool.end(); });"
```

Expected output:
```
Content Checks: { total: '289', with_inspector: '106' }
```

---

**End of Testing Instructions**
