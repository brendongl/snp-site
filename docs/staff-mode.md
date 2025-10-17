# Staff Mode

Staff Mode provides additional features and information for cafe staff without requiring a full authentication system.

## Overview

Staff mode is activated by adding `?staff=true` to any URL. It's a temporary solution until proper authentication is implemented.

## How It Works

### URL Parameter

Add `?staff=true` to the URL:
```
https://yourdomain.com/games?staff=true
```

### useStaffMode Hook

**Location:** `lib/hooks/useStaffMode.ts`

```typescript
export function useStaffMode(): boolean {
  const searchParams = useSearchParams();
  const isStaff = useMemo(() => {
    return searchParams?.get('staff') === 'true';
  }, [searchParams]);
  return isStaff;
}
```

**Usage in components:**
```typescript
import { useStaffMode } from '@/lib/hooks/useStaffMode';

function MyComponent() {
  const isStaff = useStaffMode();

  return (
    <div>
      {isStaff && <StaffOnlyFeature />}
    </div>
  );
}
```

## Staff-Only Features

### Refresh Data Button

**Location:** Games page header

Already visible to all users, but intended for staff use.

**What it does:**
- Fetches latest data from Airtable
- Updates server cache
- Refreshes page with new data

**When to use:**
- After adding new games
- After updating game information
- After recording content checks

### Content Check Information

**Location:** GameDetailModal

**Shows:**
- Content Status section (bordered area)
- Status badges (Perfect/Minor/Major/Unplayable)
- Sleeved and Box Wrapped badges
- Last checked date
- Total checks count
- Latest notes preview
- "View History" button

**Hidden from non-staff** - Regular customers don't see game condition details.

### Content Check History

**Location:** ContentCheckHistory modal (opened from GameDetailModal)

**Shows:**
- Complete timeline of all content checks
- Inspector names
- Detailed condition information
- Photos indicators
- Missing pieces details
- Full notes for each check

**Accessible only in staff mode** - Regular customers cannot view check history.

## Current Limitations

### Security

⚠️ **Not secure** - Anyone can add `?staff=true` to the URL

This is acceptable because:
- No sensitive data exposed (just game conditions)
- No write operations available yet
- Inspector names are generic (no personal info)
- Intended as Phase 1 temporary solution

### Authentication Coming

**Phase 2 will include:**
- Login system (email/password)
- User roles (staff, admin, viewer)
- Session management
- Secure API endpoints
- Protected routes

## Persistence

### Current Behavior

Staff mode does NOT persist:
- Refreshing page removes `?staff=true` if navigating away
- Opening new tab requires re-adding parameter
- No cookies or localStorage

### Future Behavior

When authentication is implemented:
- Login once per session
- Automatic staff detection
- Persists across pages
- Logout button
- Remember me option

## UI Considerations

### No Visual Indicator

Currently no banner or indicator showing staff mode is active.

**Could add:**
- Small "Staff Mode" badge in corner
- Different header color
- Toggle switch to disable staff view

### Conditional Rendering

All staff-only features use conditional rendering:

```typescript
{isStaff && (
  <div className="staff-only-section">
    {/* Staff content here */}
  </div>
)}
```

This ensures:
- Clean separation of staff/customer views
- No performance impact for customers
- Easy to maintain
- Clear code structure

## Testing

### Enable Staff Mode

1. Visit any page (e.g., `/games`)
2. Add `?staff=true` to URL
3. Press Enter
4. Staff features now visible

### Verify Staff Features

1. Open game detail modal
2. Scroll to bottom
3. "Content Status" section should appear
4. Click "View History" button
5. Full check history modal should open

### Disable Staff Mode

1. Remove `?staff=true` from URL, or
2. Visit page without parameter
3. Staff features hidden

## Future Enhancements

### Phase 1 Improvements (Still No Auth)

**Staff Mode Toggle:**
- Button in header to toggle staff view
- Stores state in localStorage
- Persists across page navigation
- No URL parameter needed

**Staff Badge:**
- Visual indicator when staff mode active
- Shows in corner or header
- Optional tooltip explaining staff features

### Phase 2: Authentication

**Login System:**
- Email/password authentication
- JWT tokens
- Secure session management
- Role-based access control

**User Roles:**
- **Viewer:** Read-only access
- **Staff:** Content checks, data refresh
- **Admin:** Full access, user management

**Protected Routes:**
- Middleware checks authentication
- Automatic redirect to login
- Protected API endpoints
- CSRF protection

**User Management:**
- Create/edit/delete users
- Assign roles
- Reset passwords
- Activity logs

### Phase 3: Advanced Features

**Staff Dashboard:**
- Quick stats (games count, recent checks)
- Recent activity feed
- Tasks/reminders (games needing checks)
- Bulk operations

**Permissions System:**
- Granular permissions per feature
- Custom roles
- Temporary access grants
- Audit logs

**Mobile App:**
- Native app for staff
- Offline mode for content checks
- Push notifications
- Barcode scanning

## Best Practices

### When to Use Staff Mode

✅ **Use for:**
- Content check information
- Internal tools
- Data refresh actions
- Staff-specific UI
- Admin features

❌ **Don't use for:**
- Customer-facing features
- Critical security
- Sensitive data
- Write operations (without auth)

### Code Organization

**Good:**
```typescript
// Clear staff-only section
{isStaff && (
  <div className="border-t pt-4">
    <h3>Staff Only</h3>
    {/* Staff features */}
  </div>
)}
```

**Bad:**
```typescript
// Mixed staff/customer features
<div className={isStaff ? 'show' : 'hide'}>
  {/* Confusing mixed content */}
</div>
```

### Performance

Staff mode checks are very fast:
- `useSearchParams()` is a Next.js hook (no cost)
- `useMemo` prevents unnecessary re-renders
- Boolean check is instant

No performance concerns for using staff mode widely.

## Migration Path

### From URL Parameter to Auth

When implementing authentication:

1. **Keep useStaffMode hook** - Update implementation internally
2. **Replace parameter check with auth check:**
   ```typescript
   export function useStaffMode(): boolean {
     const session = useSession();
     return session?.user?.role === 'staff' || session?.user?.role === 'admin';
   }
   ```
3. **All components continue working** - No changes needed in components
4. **Remove URL parameter logic** - Clean up unused code

**Benefits:**
- Minimal code changes
- Same component structure
- Gradual migration possible
- No breaking changes

## Related Documentation

- [Content Checker](./content-checker.md) - Uses staff mode extensively
- [Board Games Catalog](./board-games-catalog.md) - Refresh button for staff
- [Caching System](./caching-system.md) - Manual refresh for staff
