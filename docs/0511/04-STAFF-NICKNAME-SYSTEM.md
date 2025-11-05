# Phase 4: Staff Nickname System

**Priority**: 🟡 Medium
**Effort**: Medium (1-1.5 hours)
**Dependencies**: None (but blocks Phase 5, 6, 7)
**Affects**: All staff name displays across the application

---

## Problem Statement

Currently, full names are displayed throughout the application:
- "Thịnh Văn Hoàng Vũ" → Should be "Vu"
- "Nguyen Thanh Phong (Chase)" → Should be "Chase"
- "Brendon Gan-Le" → Should be "Brendon"

**Requirements:**
- Display nicknames (last names) everywhere EXCEPT Staff Directory
- Staff Directory shows full names
- Special cases: Chase (not Phong), Brendon (not Gan-Le)

---

## Staff Nickname Mapping

| Full Name | Nickname | Special Case |
|-----------|----------|--------------|
| Thịnh Văn Hoàng Vũ | Vu | Last name |
| Nguyễn Thị Thùy Hương | Huong | Last name |
| Phạm Huy Hoàng | Hoang | Last name |
| Lê Tiến Duy | Duy | Last name |
| Nguyễn Thị Thanh Tâm | Tam | Last name |
| Đào Ngọc Anh | Anh | Last name |
| Trần Thị Bảo Châu | Chau | Last name |
| Nguyễn Phạm Minh Hoàng | Hoang | Last name |
| Vũ Thị Hồng Ngọc | Ngoc | Last name |
| Trần Thị Hoa | Hoa | Last name |
| Lương Đức Hòa | Hoa | Last name |
| Nguyen Thanh Phong | Chase | ⚠️ Special: Use "Chase" |
| Brendon Gan-Le | Brendon | ⚠️ Special: Use "Brendon" |

---

## Implementation Strategy

### Option A: Database Column (Recommended)
Add a `nickname` column to `staff_list` table and populate it.

**Pros:**
- Centralized data source
- Easy to update
- No frontend logic needed

**Cons:**
- Requires database migration

### Option B: Helper Function (Quick)
Create a helper function to extract/map nicknames.

**Pros:**
- No database changes
- Quick to implement

**Cons:**
- Logic scattered in frontend
- Harder to maintain

**Recommendation**: Use Option A for long-term maintainability.

---

## Database Migration

### Files to Create
- [scripts/add-staff-nicknames.js](../../scripts/add-staff-nicknames.js)

### Implementation

```javascript
/**
 * Migration script to add nickname column to staff_list table
 * Run: node scripts/add-staff-nicknames.js
 */

import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config();

const STAFF_NICKNAMES = [
  { name: 'Thịnh Văn Hoàng Vũ', nickname: 'Vu' },
  { name: 'Nguyễn Thị Thùy Hương', nickname: 'Huong' },
  { name: 'Phạm Huy Hoàng', nickname: 'Hoang' },
  { name: 'Lê Tiến Duy', nickname: 'Duy' },
  { name: 'Nguyễn Thị Thanh Tâm', nickname: 'Tam' },
  { name: 'Đào Ngọc Anh', nickname: 'Anh' },
  { name: 'Trần Thị Bảo Châu', nickname: 'Chau' },
  { name: 'Nguyễn Phạm Minh Hoàng', nickname: 'Hoang' },
  { name: 'Vũ Thị Hồng Ngọc', nickname: 'Ngoc' },
  { name: 'Trần Thị Hoa', nickname: 'Hoa' },
  { name: 'Lương Đức Hòa', nickname: 'Hoa' },
  { name: 'Nguyen Thanh Phong', nickname: 'Chase' },
  { name: 'Brendon Gan-Le', nickname: 'Brendon' },
];

async function addNicknameColumn() {
  try {
    console.log('Adding nickname column to staff_list...');

    // Add column if it doesn't exist
    await sql`
      ALTER TABLE staff_list
      ADD COLUMN IF NOT EXISTS nickname TEXT;
    `;

    console.log('✓ Nickname column added');

    // Update nicknames for each staff member
    console.log('\nUpdating staff nicknames...');
    let updated = 0;

    for (const staff of STAFF_NICKNAMES) {
      const result = await sql`
        UPDATE staff_list
        SET nickname = ${staff.nickname}
        WHERE full_name = ${staff.name};
      `;

      if (result.rowCount > 0) {
        console.log(`✓ ${staff.name} → ${staff.nickname}`);
        updated++;
      } else {
        console.log(`⚠️  No match found for: ${staff.name}`);
      }
    }

    console.log(`\n✓ Successfully updated ${updated} staff members`);

    // Verify results
    console.log('\nVerifying results...');
    const verification = await sql`
      SELECT full_name, nickname
      FROM staff_list
      ORDER BY full_name;
    `;

    console.table(verification.rows);

  } catch (error) {
    console.error('Error adding nicknames:', error);
    throw error;
  }
}

addNicknameColumn()
  .then(() => {
    console.log('\n✓ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
```

---

## Frontend Updates

### Files to Modify

**All Staff Name Displays (except Staff Directory):**
1. [components/features/staff/StaffMenu.tsx](../../components/features/staff/StaffMenu.tsx) - Header display
2. [app/staff/dashboard/page.tsx](../../app/staff/dashboard/page.tsx) - Recent Activity
3. [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx) - Activity log
4. [app/staff/check-history/page.tsx](../../app/staff/check-history/page.tsx) - Inspector names
5. [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx) - Last checked by
6. [components/features/content-check/ContentCheckHistory.tsx](../../components/features/content-check/ContentCheckHistory.tsx) - Inspector names
7. [components/features/staff/ActivityLog.tsx](../../components/features/staff/ActivityLog.tsx) - Activity entries
8. [components/features/staff/KnowledgeStats.tsx](../../components/features/staff/KnowledgeStats.tsx) - Knowledge cards

**Keep Full Name:**
- [app/staff/directory/page.tsx](../../app/staff/directory/page.tsx) - Staff Directory

### Implementation Pattern

**Before:**
```tsx
<span>{staffMember.full_name}</span>
```

**After:**
```tsx
<span>{staffMember.nickname || staffMember.full_name}</span>
```

**Or create helper:**
```tsx
// lib/utils/staff-utils.ts
export const getDisplayName = (staff: { nickname?: string; full_name: string }) => {
  return staff.nickname || staff.full_name;
};

// Usage
<span>{getDisplayName(staffMember)}</span>
```

---

## API Updates

### Files to Modify
- [app/api/staff-list/route.ts](../../app/api/staff-list/route.ts)
- [lib/services/staff-db-service.ts](../../lib/services/staff-db-service.ts)

### Implementation

**Ensure API returns nickname field:**

```typescript
// In staff-db-service.ts
async getAllStaff() {
  const result = await sql`
    SELECT
      id,
      full_name,
      nickname,  -- Add this field
      email,
      phone,
      hire_date,
      points,
      vikunja_user_id,
      vikunja_username
    FROM staff_list
    ORDER BY full_name ASC;
  `;

  return result.rows;
}
```

---

## TypeScript Type Updates

### Files to Modify
- [types/index.ts](../../types/index.ts)

### Implementation

```typescript
export interface StaffMember {
  id: string;
  full_name: string;
  nickname?: string;  // Add this field
  email: string;
  phone?: string;
  hire_date?: string;
  points: number;
  vikunja_user_id?: number;
  vikunja_username?: string;
}
```

---

## Implementation Steps

### Step 1: Database Migration
1. Create [scripts/add-staff-nicknames.js](../../scripts/add-staff-nicknames.js)
2. Run migration:
   ```bash
   node scripts/add-staff-nicknames.js
   ```
3. Verify all 13 staff members updated

### Step 2: Update TypeScript Types
1. Open [types/index.ts](../../types/index.ts)
2. Add `nickname?: string` to `StaffMember` interface

### Step 3: Update API/Service Layer
1. Open [lib/services/staff-db-service.ts](../../lib/services/staff-db-service.ts)
2. Add `nickname` to SELECT queries
3. Test API response includes nickname

### Step 4: Create Display Helper (Optional)
1. Create [lib/utils/staff-utils.ts](../../lib/utils/staff-utils.ts)
2. Implement `getDisplayName()` helper

### Step 5: Update Frontend Components
Go through each file and replace `full_name` with `nickname || full_name`:

1. [StaffMenu.tsx](../../components/features/staff/StaffMenu.tsx)
2. [Dashboard page](../../app/staff/dashboard/page.tsx)
3. [Changelog page](../../app/staff/changelog/page.tsx)
4. [Check history page](../../app/staff/check-history/page.tsx)
5. [GameDetailModal](../../components/features/games/GameDetailModal.tsx)
6. [ContentCheckHistory](../../components/features/content-check/ContentCheckHistory.tsx)
7. [ActivityLog](../../components/features/staff/ActivityLog.tsx)
8. [KnowledgeStats](../../components/features/staff/KnowledgeStats.tsx)

**Do NOT modify:**
- [Staff Directory page](../../app/staff/directory/page.tsx) - Keep full names

### Step 6: Test Display Changes
1. Login as staff member
2. Verify header shows nickname
3. Check dashboard Recent Activity shows nicknames
4. Verify changelog shows nicknames
5. Check game dialog "Last checked by" shows nickname
6. Verify Staff Directory still shows full names

### Step 7: Commit and Deploy
```bash
git add .
git commit -m "v1.5.6 - Implement staff nickname system

- Add nickname column to staff_list table
- Display nicknames across all pages (except Staff Directory)
- Special cases: Chase, Brendon
- Update TypeScript types

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## Testing Checklist

### Database Migration
- [ ] Nickname column added to staff_list
- [ ] All 13 staff members have nicknames
- [ ] Special cases (Chase, Brendon) correct

### API Updates
- [ ] API returns nickname field
- [ ] TypeScript types updated
- [ ] No TypeScript errors

### Frontend Display
- [ ] Header shows nickname (StaffMenu)
- [ ] Dashboard Recent Activity shows nicknames
- [ ] Changelog shows nicknames
- [ ] Check history inspector names are nicknames
- [ ] Game dialog "Last checked by" shows nickname
- [ ] Content check history shows nicknames
- [ ] Activity log shows nicknames
- [ ] Knowledge stats show nicknames
- [ ] Staff Directory still shows FULL NAMES

---

## Rollback Plan

If issues arise:
1. Revert frontend changes (fallback to full_name)
2. Database column can remain (won't break anything)
3. Remove nickname column if needed:
   ```sql
   ALTER TABLE staff_list DROP COLUMN nickname;
   ```

---

## Estimated Timeline

- **Database Migration**: 15 minutes
- **API Updates**: 15 minutes
- **Frontend Updates**: 45 minutes
- **Testing**: 15 minutes
- **Total**: ~1.5 hours

---

## Related Files

### Database
- [scripts/add-staff-nicknames.js](../../scripts/add-staff-nicknames.js) (new)

### Types
- [types/index.ts](../../types/index.ts)

### Services
- [lib/services/staff-db-service.ts](../../lib/services/staff-db-service.ts)

### Components (Update All)
- [components/features/staff/StaffMenu.tsx](../../components/features/staff/StaffMenu.tsx)
- [components/features/staff/ActivityLog.tsx](../../components/features/staff/ActivityLog.tsx)
- [components/features/staff/KnowledgeStats.tsx](../../components/features/staff/KnowledgeStats.tsx)
- [components/features/content-check/ContentCheckHistory.tsx](../../components/features/content-check/ContentCheckHistory.tsx)
- [components/features/games/GameDetailModal.tsx](../../components/features/games/GameDetailModal.tsx)

### Pages (Update All)
- [app/staff/dashboard/page.tsx](../../app/staff/dashboard/page.tsx)
- [app/staff/changelog/page.tsx](../../app/staff/changelog/page.tsx)
- [app/staff/check-history/page.tsx](../../app/staff/check-history/page.tsx)

### Pages (Keep Full Name)
- [app/staff/directory/page.tsx](../../app/staff/directory/page.tsx) - ⚠️ DO NOT MODIFY

---

## Notes

- Nickname is optional field (fallback to full_name if missing)
- Staff Directory is the only place showing full names
- Consider adding nickname edit feature in Staff Directory (future enhancement)
- Vietnamese diacritics in nicknames are intentional and should be preserved
