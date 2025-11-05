# Bugfix & UI/UX Improvements - May 11, 2025

**Status**: Planning Phase
**Total Issues**: 14
**Organized into**: 9 Phases

---

## Quick Reference

| Phase | Focus Area | Issues | Priority | Estimated Effort |
|-------|-----------|--------|----------|------------------|
| [Phase 1](01-IPOS-PLAYWRIGHT-FIX.md) | Infrastructure | 1 issue | 🔴 Critical | Small |
| [Phase 2](02-MOBILE-RESPONSIVENESS.md) | Mobile UX | 2 issues | 🟠 High | Small |
| [Phase 3](03-ISSUE-REPORTING-OVERHAUL.md) | Issue Reporting | 3 issues | 🟠 High | Large |
| [Phase 4](04-STAFF-NICKNAME-SYSTEM.md) | Staff Identity | 1 issue | 🟡 Medium | Medium |
| [Phase 5](05-STAFF-KNOWLEDGE-DISPLAY.md) | Game Dialog | 1 issue | 🟡 Medium | Medium |
| [Phase 6](06-DASHBOARD-ACTIVITY-FIXES.md) | Dashboard | 2 issues | 🟡 Medium | Medium |
| [Phase 7](07-POINTS-ANALYTICS.md) | Analytics & Persistent UI | 2 issues | 🟡 Medium | Large |
| [Phase 8](08-CONTENT-CHECK-WORDING.md) | Copy Changes | 1 issue | 🟢 Low | Small |
| [Phase 9](09-DATA-CLEANUP-MIGRATION.md) | Data Migration | 1 issue | 🟢 Low | Large |

---

## Issue Mapping

### Phase 1: Critical Infrastructure Fix
- **Issue #1**: iPOS scraping not working on Railway (Playwright browser missing)

### Phase 2: Mobile Responsiveness
- **Issue #2**: iPOS mobile horizontal scrolling (remove "Tables/Customers" text)
- **Issue #13**: Check history table not mobile-friendly

### Phase 3: Issue Reporting System Overhaul
- **Issue #3**: Remove checklist overlay, add "Report Issue" button to game dialog
- **Issue #4**: Display task titles in game notes section
- **Issue #5**: Update Content Check dialog's "Report Issue" toggle

### Phase 4: Staff Nickname System
- **Issue #8**: Implement last name nicknames for all staff displays

### Phase 5: Staff Knowledge Display
- **Issue #10**: Show staff knowledge in game dialogs (both views)

### Phase 6: Dashboard & Activity Improvements
- **Issue #11**: Add points earned to Recent Activity entries
- **Issue #12**: Fix missing point action categories in Recent Activity

### Phase 7: Points System Analytics & Persistent UI
- **Issue #7**: Add points statistics to Changelog analytics
- **Issue #9**: Persistent logged-in user/points display across all pages

### Phase 8: Content Check Wording Updates
- **Issue #6**: Reword content check labels

### Phase 9: Data Cleanup & Migration
- **Issue #14**: Analyze content checks for missing items, create Vikunja tasks

---

## Recommended Execution Order

### Week 1: Critical & High Priority

**Goal**: Fix critical infrastructure bug, improve mobile UX, and deliver quick wins
**Total Estimated Time**: ~2 hours
**Risk Level**: Low (all independent changes)

#### Execution Sequence

**Day 1: Infrastructure Fix (Phase 1)**
- **Phase 1** - Fix iPOS Playwright on Railway
- **Time**: 45 minutes
- **Priority**: 🔴 Critical
- **Why first**: Fixes production bug blocking iPOS scraping feature
- **Steps**:
  1. Update [Dockerfile](../../Dockerfile) with Playwright installation
  2. Build and test locally (optional)
  3. Deploy to staging
  4. Test iPOS scraping endpoint
  5. Deploy to production after user approval
- **Risk**: Low - single Dockerfile change, easy rollback
- **Success criteria**: No Playwright browser errors in Railway logs

**Day 1-2: Mobile UX Improvements (Phase 2)**
- **Phase 2** - Mobile Responsiveness Fixes
- **Time**: 45 minutes
- **Priority**: 🟠 High
- **Why second**: Improves user experience on mobile devices (no dependencies on Phase 1)
- **Two fixes in one**:
  1. **Fix #2**: Hide "Tables/Customers" labels on iPOS mobile view (5-10 min)
  2. **Fix #13**: Make check history table mobile-friendly with status icons (30-35 min)
- **Files modified**:
  - [app/admin/pos-settings/page.tsx](../../app/admin/pos-settings/page.tsx)
  - [app/staff/check-history/page.tsx](../../app/staff/check-history/page.tsx)
- **Risk**: Low - CSS/UI changes only, no database modifications
- **Success criteria**: No horizontal scrolling on mobile viewports (320px, 375px, 414px)

**Day 2: Quick Win (Phase 8)**
- **Phase 8** - Content Check Wording Updates
- **Time**: 15 minutes
- **Priority**: 🟢 Low (but easy!)
- **Why third**: Quick win to deliver while waiting for Phase 1-2 testing feedback
- **Changes**: Simple text replacements in Content Check dialog
  - "sleeved at check" → "All cards are Sleeved"
  - "box wrapped at check" → "Box is wrapped"
- **Risk**: Minimal - UI text only, no logic changes
- **Success criteria**: New wording displays in content check dialog

#### Testing Strategy for Week 1

**Phase 1 Testing**:
```bash
# On staging
curl https://staging-url/api/admin/ipos-dashboard
# Should return data without Playwright errors
```

**Phase 2 Testing**:
- Open Chrome DevTools
- Toggle device toolbar (Ctrl+Shift+M)
- Test viewports: iPhone SE (375px), iPhone 12 Pro (390px), Pixel 5 (393px)
- Verify no horizontal scrolling
- Check status icons display correctly

**Phase 8 Testing**:
- Open any game card in staff mode
- Click content check button
- Verify new wording displays
- Test checkbox functionality

#### Deployment Sequence

**Option A: Three Separate Deploys (Recommended)**
1. Deploy Phase 1 → Test → User approval → Merge to main
2. Deploy Phase 2 → Test → User approval → Merge to main
3. Deploy Phase 8 → Test → User approval → Merge to main

**Option B: Combined Deploy (Faster)**
1. Complete all three phases locally
2. Single commit with version bump (v1.5.6)
3. Deploy to staging → Comprehensive testing
4. User approval → Merge to main

#### Version Numbering
- **v1.5.6** - Use PATCH increment (bug fixes and small improvements)
- Update both [lib/version.ts](../../lib/version.ts) and [package.json](../../package.json)

#### Week 1 Deliverables Summary

**What's Fixed**:
- ✅ iPOS scraping works on Railway (no more Playwright errors)
- ✅ Mobile users can view iPOS dashboard without horizontal scrolling
- ✅ Staff can view check history table on mobile devices
- ✅ Content check dialog has clearer, more professional wording

**Files Modified** (7 files):
1. [Dockerfile](../../Dockerfile) - Add Playwright installation
2. [lib/version.ts](../../lib/version.ts) - Version bump
3. [package.json](../../package.json) - Version bump
4. [app/admin/pos-settings/page.tsx](../../app/admin/pos-settings/page.tsx) - Mobile labels
5. [app/staff/check-history/page.tsx](../../app/staff/check-history/page.tsx) - Mobile table + status icons
6. [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx) - Wording updates

**Database Changes**: None
**API Changes**: None
**Breaking Changes**: None

**User-Facing Impact**:
- Admin: iPOS dashboard now works on production
- Staff (Mobile): Better mobile experience on check history page
- Staff (Mobile): iPOS stats readable without scrolling
- Staff (All): Clearer content check labels

---

### Week 2: Issue Reporting & Staff System

**Goal**: Overhaul issue reporting workflow and implement staff nickname system
**Total Estimated Time**: ~4.5 hours
**Risk Level**: Medium (UI changes, database migration, affects multiple pages)

#### Execution Sequence

**Day 1-2: Issue Reporting Overhaul (Phase 3)**
- **Phase 3** - Issue Reporting System Overhaul
- **Time**: 2-3 hours
- **Priority**: 🟠 High
- **Why first**: Large refactor, better to complete before nickname system
- **What it fixes**:
  - Remove confusing middle checklist icon overlay
  - Add "Report Issue" button inside game dialog (more discoverable)
  - Display active Vikunja task titles in game notes
  - Modernize Content Check dialog issue reporting

**Implementation Steps**:

1. **Create Shared Components** (45 min)
   - Create `components/features/issues/IssueReportDialog.tsx`
     - Pre-defined issue types (9 options)
     - Point values: 200-1000 points per issue type
     - Complexity levels for task prioritization
   - Create `app/api/vikunja/tasks/by-game/route.ts`
     - Fetch tasks from Vikunja "Observation Notes" project
     - Filter by game ID in description
     - Extract issue type from task title

2. **Remove Checklist Overlay** (30 min)
   - Edit [GameCard.tsx](../../components/features/games/GameCard.tsx)
     - Remove middle icon overlay button
     - Delete "what would you like to do" dialog
     - Clean up state variables (`showQuickActionsDialog`, etc.)
   - **Result**: Cleaner card UI, no confusing overlay

3. **Update Game Detail Modal** (45 min)
   - Edit [GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)
     - Add "Report Issue" button next to Content Check/Play Log buttons
     - Add `linkedIssues` state and fetch on dialog open
     - Display active issues in Notes section with yellow badge
     - Show issue type (e.g., "broken sleeves", "missing pieces")
   - **Result**: Issues visible immediately when opening game dialog

4. **Update Content Check Dialog** (30 min)
   - Edit [ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)
     - Remove old "Report an Issue" toggle/textarea
     - Add new "Report Issue" button at bottom
     - Integrate `IssueReportDialog` component
   - **Result**: Consistent issue reporting across both dialogs

5. **End-to-End Testing** (30 min)
   - Test issue reporting from game dialog
   - Verify Vikunja task creation with:
     - Correct title format: "{Issue Type} - {Game Name}"
     - Point labels assigned
     - Game ID in description
   - Confirm issue appears in game notes section
   - Test from content check dialog
   - Verify middle overlay removed from all game cards

**Files Modified** (4 files):
- [components/features/games/GameCard.tsx](../../components/features/games/GameCard.tsx)
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)
- [components/features/content-check/ContentCheckDialog.tsx](../../components/features/content-check/ContentCheckDialog.tsx)

**Files Created** (2 files):
- [components/features/issues/IssueReportDialog.tsx](../../components/features/issues/IssueReportDialog.tsx)
- [app/api/vikunja/tasks/by-game/route.ts](../../app/api/vikunja/tasks/by-game/route.ts)

**Deploy**: `v1.5.7` - Issue reporting system overhaul

**Risk**: Medium
- Large UI refactor across 3 components
- New API endpoint for Vikunja integration
- **Mitigation**: Test thoroughly on staging, easy rollback by reverting commit

---

**Day 3: Staff Nickname System (Phase 4)**
- **Phase 4** - Implement Staff Nicknames
- **Time**: 1-1.5 hours
- **Priority**: 🟡 Medium
- **Why second**: Blocks Phase 5, 6, 7 (all need nickname display)
- **What it changes**: Display last names instead of full names everywhere except Staff Directory

**Special Cases**:
- "Nguyen Thanh Phong" → "Chase" (not "Phong")
- "Brendon Gan-Le" → "Brendon" (not "Gan-Le")
- All other staff: Use last name (e.g., "Thịnh Văn Hoàng Vũ" → "Vu")

**Implementation Steps**:

1. **Database Migration** (15 min)
   - Create [scripts/add-staff-nicknames.js](../../scripts/add-staff-nicknames.js)
   - Add `nickname` column to `staff_list` table
   - Populate 13 staff nicknames (hardcoded mapping)
   - Run migration:
     ```bash
     node scripts/add-staff-nicknames.js
     ```
   - Verify all 13 staff members updated with `SELECT full_name, nickname FROM staff_list`

2. **Update Types & API** (15 min)
   - Edit [types/index.ts](../../types/index.ts)
     - Add `nickname?: string` to `StaffMember` interface
   - Edit [lib/services/staff-db-service.ts](../../lib/services/staff-db-service.ts)
     - Add `nickname` to all SELECT queries
   - Test API: `GET /api/staff-list` should return nickname field

3. **Create Display Helper** (Optional, 10 min)
   - Create [lib/utils/staff-utils.ts](../../lib/utils/staff-utils.ts)
   - Implement helper:
     ```typescript
     export const getDisplayName = (staff: { nickname?: string; full_name: string }) => {
       return staff.nickname || staff.full_name;
     };
     ```

4. **Update 8 Components** (45 min)
   - Replace all instances of `{staffMember.full_name}` with `{staffMember.nickname || staffMember.full_name}`
   - **Files to modify**:
     1. [components/features/staff/StaffMenu.tsx](../../components/features/staff/StaffMenu.tsx) - Header display
     2. [app/staff/dashboard/page.tsx](../../app/staff/dashboard/page.tsx) - Recent Activity
     3. [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx) - Activity log
     4. [app/staff/check-history/page.tsx](../../app/staff/check-history/page.tsx) - Inspector names
     5. [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx) - "Last checked by"
     6. [components/features/content-check/ContentCheckHistory.tsx](../../components/features/content-check/ContentCheckHistory.tsx) - Inspector names
     7. [components/features/staff/ActivityLog.tsx](../../components/features/staff/ActivityLog.tsx) - Activity entries
     8. [components/features/staff/KnowledgeStats.tsx](../../components/features/staff/KnowledgeStats.tsx) - Knowledge cards

5. **Keep Full Names (Do NOT Modify)**
   - [app/staff/directory/page.tsx](../../app/staff/directory/page.tsx) - Staff Directory
   - **Reason**: Directory should show official full names

6. **Testing** (15 min)
   - Login as staff member
   - Verify header shows nickname (e.g., "Vu" not "Thịnh Văn Hoàng Vũ")
   - Check dashboard Recent Activity uses nicknames
   - Open game dialog → Verify "Last checked by: {Nickname}"
   - Visit Staff Directory → Verify full names still display
   - Test special cases: Chase, Brendon

**Files Modified** (11 files):
- Database: `staff_list` table (add nickname column)
- [types/index.ts](../../types/index.ts)
- [lib/services/staff-db-service.ts](../../lib/services/staff-db-service.ts)
- 8 component/page files listed above

**Files Created** (2 files):
- [scripts/add-staff-nicknames.js](../../scripts/add-staff-nicknames.js)
- [lib/utils/staff-utils.ts](../../lib/utils/staff-utils.ts) (optional)

**Deploy**: `v1.5.8` - Implement staff nickname system

**Risk**: Low-Medium
- Database migration (adds column, safe operation)
- Affects display across 8+ components
- **Mitigation**: Column is optional (`nickname?`), falls back to `full_name` if missing

---

#### Testing Strategy for Week 2

**Phase 3 Testing Checklist**:
- [ ] IssueReportDialog opens from game dialog
- [ ] IssueReportDialog opens from content check dialog
- [ ] Issue type dropdown has 9 options
- [ ] Point values display correctly (200-1000 points)
- [ ] Submit creates Vikunja task with correct format
- [ ] Task appears in Vikunja "Observation Notes" project
- [ ] Game notes section displays active issues (yellow badge)
- [ ] Middle checklist overlay removed from game cards
- [ ] No console errors

**Phase 4 Testing Checklist**:
- [ ] Database migration completes successfully
- [ ] All 13 staff members have nicknames
- [ ] Special cases correct: Chase, Brendon
- [ ] Header displays nickname (StaffMenu)
- [ ] Dashboard Recent Activity shows nicknames
- [ ] Changelog shows nicknames
- [ ] Check history inspector names are nicknames
- [ ] Game dialog "Last checked by" shows nickname
- [ ] Staff Directory STILL shows full names
- [ ] No TypeScript errors

#### Deployment Sequence

**Recommended: Two Separate Deploys**
1. **Deploy Phase 3** → Test issue reporting → User approval → Merge to main
2. **Deploy Phase 4** → Test nickname display → User approval → Merge to main

**Alternative: Combined Deploy (Not Recommended)**
- Too many changes across different systems
- Harder to isolate issues if something breaks

#### Version Numbering
- **v1.5.7** - Phase 3 (Issue Reporting Overhaul)
- **v1.5.8** - Phase 4 (Staff Nicknames)
- Use PATCH increments (bug fixes and improvements)

#### Week 2 Deliverables Summary

**What's Improved**:
- ✅ Issue reporting is more discoverable and user-friendly
- ✅ Active game issues visible in game dialog notes
- ✅ Consistent issue reporting across game dialog and content check dialog
- ✅ Staff names are shorter and easier to read (nicknames)
- ✅ Staff Directory maintains professional full names

**Database Changes**:
- Added `nickname` column to `staff_list` table (Phase 4)

**API Changes**:
- New endpoint: `GET /api/vikunja/tasks/by-game?gameId={id}` (Phase 3)

**Breaking Changes**: None

**User-Facing Impact**:
- Staff: Easier issue reporting with pre-defined types
- Staff: Can see active issues immediately when viewing games
- Staff: Faster to read names in activity logs and dashboards
- Staff: Directory still shows full names for official reference

**Unblocks**:
- Phase 5 (Staff Knowledge Display)
- Phase 6 (Dashboard Fixes)
- Phase 7 (Points Analytics)

---

### Week 3: Dashboard & Analytics
6. **Phase 5** (Staff Knowledge Display) - Depends on Phase 4
7. **Phase 6** (Dashboard Fixes) - Depends on Phase 4
8. **Phase 7** (Points Analytics) - Depends on Phase 4

### Week 4: Data Cleanup
9. **Phase 9** (Data Migration) - Can run in parallel with testing

---

## Testing Strategy

Each phase includes:
- **Local Development Testing**: Test on `npm run dev`
- **Staging Deployment**: Push to `staging` branch first
- **User Acceptance Testing**: Confirm with user before pushing to main
- **Production Deployment**: Only after user says "push to main"

---

## Dependencies Between Phases

```
Phase 1 (iPOS Fix) → Independent
Phase 2 (Mobile) → Independent
Phase 3 (Issue Reporting) → Independent
Phase 4 (Nicknames) → Blocks Phase 5, 6, 7
Phase 5 (Staff Knowledge) → Depends on Phase 4
Phase 6 (Dashboard) → Depends on Phase 4
Phase 7 (Points Analytics) → Depends on Phase 4
Phase 8 (Wording) → Independent
Phase 9 (Data Cleanup) → Independent
```

---

## Notes

- All phases designed to fit within one context window
- Each phase has detailed implementation steps
- Database changes are minimal and safe
- All changes go to `staging` first, then `main` after user approval
- Version bumps: Use PATCH version increments (e.g., 1.5.5 → 1.5.6) unless phase warrants MINOR bump
