# Phase 3: Admin UI for Roster Management
**Date**: January 11, 2025
**Version**: 3.0.0
**Status**: 📋 Planning
**Prerequisites**: Phase 2 Complete ✅

---

## Executive Summary

Phase 3 focuses on creating an intuitive admin interface for managing the AI-powered rostering system. The UI will allow administrators to generate rosters, view schedules in calendar format, manually adjust assignments, create scheduling rules using natural language, and resolve constraint violations.

**Goal**: Make the constraint solver accessible to non-technical users through a polished web interface.

---

## Core Features

### 1. Roster Generation Dashboard
**Route**: `/staff/roster/generate`

**Components**:
- Week selector (date picker for Monday start dates)
- Generation options panel:
  - Max hours per week slider (0-50 hours)
  - Fairness preference toggle
  - Auto-save checkbox
  - Use default shift requirements toggle
- Generate button with loading state
- Results summary card:
  - Total shifts assigned
  - Total unassigned shifts
  - Average hours per staff member
  - Solution score
  - Validity indicator (✅ Valid / ⚠️ Has violations)

**User Flow**:
1. Admin selects week start date (validates Monday)
2. Adjusts generation parameters
3. Clicks "Generate Roster"
4. System calls `/api/roster/generate` with parameters
5. Results display immediately with option to save
6. If violations exist, show warning banner with "View Violations" button

---

### 2. Calendar View
**Route**: `/staff/roster/calendar`

**Layout**: 7-column grid (Monday-Sunday)

**Components**:
- Week navigation (previous/next week arrows)
- Staff filter dropdown (show all / specific staff member)
- Shift type filter (all / opening / day / evening / closing)
- Day columns with shift cards:
  ```
  ┌─────────────────┐
  │ Monday          │
  │ Jan 13, 2025    │
  ├─────────────────┤
  │ 🔑 Opening      │
  │ 9:00am - 2:00pm │
  │ Brendon (cafe)  │
  │ [Edit]          │
  ├─────────────────┤
  │ Day Shift       │
  │ 2:00pm - 6:00pm │
  │ Minh (floor)    │
  │ [Edit]          │
  └─────────────────┘
  ```

**Shift Card Features**:
- Staff name with avatar/initials
- Shift type badge (color-coded)
- Time range
- Role indicator
- Edit button (opens shift edit dialog)
- Constraint violation warning (if applicable)

**Color Coding**:
- 🟢 Opening shifts: Green (#22c55e)
- 🔵 Day shifts: Blue (#3b82f6)
- 🟣 Evening shifts: Purple (#a855f7)
- 🔴 Closing shifts: Red (#ef4444)
- ⚠️ Violations: Yellow (#eab308)

---

### 3. Staff Hours Summary
**Route**: `/staff/roster/summary`

**Components**:
- Week selector
- Staff table with columns:
  - Staff Name
  - Total Hours
  - Shift Count
  - Average Hours per Shift
  - Status (Under / Optimal / Over / Maxed)
  - Actions (View Schedule / Edit Availability)

**Status Indicators**:
- 🟢 **Optimal**: 20-35 hours
- 🟡 **Under**: <20 hours
- 🟠 **Over**: 35-40 hours
- 🔴 **Maxed**: ≥40 hours

**Features**:
- Sort by hours (ascending/descending)
- Export to CSV
- Print-friendly view
- Fairness meter (visual indicator of hour distribution)

---

### 4. Scheduling Rules Manager
**Route**: `/staff/roster/rules`

**Components**:
- Rules list table:
  - Rule text (natural language)
  - Created by (staff member)
  - Weight (importance 0-100)
  - Active status toggle
  - Expires at date
  - Actions (Edit / Delete / Deactivate)

- "Create New Rule" button → Opens rule creation dialog

**Rule Creation Dialog**:
```
┌───────────────────────────────────────┐
│ Create Scheduling Rule                │
├───────────────────────────────────────┤
│ Enter rule in plain English:          │
│                                       │
│ ┌─────────────────────────────────┐ │
│ │ Brendon should work no more     │ │
│ │ than 35 hours per week          │ │
│ └─────────────────────────────────┘ │
│                                       │
│ [Parse Rule]                          │
│                                       │
│ Parsed Constraint:                    │
│ Type: max_hours                       │
│ Staff: Brendon Gan-Le                 │
│ Max Hours: 35                         │
│ Suggested Weight: 80                  │
│                                       │
│ Weight: [====|----] 80                │
│                                       │
│ Expires: [2025-12-31] (optional)      │
│                                       │
│ [Cancel] [Save Rule]                  │
└───────────────────────────────────────┘
```

**Features**:
- Real-time rule parsing using Claude API
- Validation feedback
- Weight slider (0-100)
- Expiration date picker
- Example rules dropdown for quick selection

---

### 5. Constraint Violations Viewer
**Route**: `/staff/roster/violations`

**Components**:
- Week selector
- Severity filter (All / Hard / Soft)
- Violations list:
  ```
  ┌────────────────────────────────────────┐
  │ ⚠️ Hard Constraint Violation           │
  │ NO_AVAILABLE_STAFF                     │
  ├────────────────────────────────────────┤
  │ Sunday Opening Shift (9:00am - 2:00pm) │
  │ No staff available with required keys  │
  │                                        │
  │ Shift Requirements:                    │
  │ - Role: cafe                           │
  │ - Requires keys: Yes                   │
  │                                        │
  │ Available Staff:                       │
  │ - Brendon: Has keys, but unavailable   │
  │ - Minh: Available, but no keys         │
  │ - Phong: Available, but no keys        │
  │                                        │
  │ [Assign Manually] [Adjust Requirements]│
  └────────────────────────────────────────┘
  ```

**Features**:
- Detailed violation explanations
- Suggested fixes:
  - Manually assign staff
  - Adjust shift requirements
  - Update staff availability
  - Grant keys to staff member
- One-click resolution actions

---

### 6. Shift Requirements Editor
**Route**: `/staff/roster/shift-requirements`

**Components**:
- Template selector (Default / Custom)
- 7-day grid for editing shift requirements
- Add shift button per day
- Shift requirement form:
  - Shift type (dropdown)
  - Start time (time picker)
  - End time (time picker)
  - Role required (dropdown)
  - Min staff (number input)
  - Max staff (number input)
  - Requires keys (checkbox)

**Templates**:
- **Default**: Current 23-shift template (opening/day/evening/closing)
- **Weekends Only**: Only Saturday & Sunday shifts
- **Reduced Hours**: Shorter shifts (9am-6pm instead of 9am-11pm)
- **Custom**: User-defined from scratch

**Features**:
- Duplicate shift to other days
- Bulk edit (select multiple shifts)
- Save as template
- Preview shift coverage

---

## API Integration Plan

### New API Endpoints Needed

#### 1. Shift Management
```typescript
// Save generated roster
POST /api/roster/shifts/bulk-create
Body: {
  week_start: string;
  assignments: ShiftAssignment[];
}

// Update single shift
PUT /api/roster/shifts/:id
Body: {
  staff_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

// Delete shift
DELETE /api/roster/shifts/:id
```

#### 2. Shift Requirements
```typescript
// Get shift requirements for week
GET /api/roster/shift-requirements?week_start=2025-01-13

// Update shift requirements template
POST /api/roster/shift-requirements
Body: {
  template_name: string;
  requirements: ShiftRequirement[];
}
```

#### 3. Rules Management
```typescript
// Already exists:
// POST /api/roster/rules/parse
// GET /api/roster/rules/parse

// Additional needed:
PUT /api/roster/rules/:id
DELETE /api/roster/rules/:id
PATCH /api/roster/rules/:id/toggle
```

---

## Database Schema Updates

### New Tables Needed

#### shift_requirement_templates
```sql
CREATE TABLE shift_requirement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  requirements JSONB NOT NULL,
  created_by UUID REFERENCES staff_list(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### roster_metadata
```sql
CREATE TABLE roster_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_week_start DATE NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by UUID REFERENCES staff_list(id),
  solution_score NUMERIC,
  is_valid BOOLEAN DEFAULT false,
  violations JSONB,
  notes TEXT,
  UNIQUE(roster_week_start)
);
```

---

## UI Component Library

### shadcn/ui Components Required
- [x] Button
- [x] Card
- [x] Dialog
- [x] Input
- [x] Label
- [x] Select
- [x] Slider
- [x] Switch
- [x] Table
- [x] Tabs
- [ ] Badge (new)
- [ ] Calendar (new)
- [ ] Popover (new)
- [ ] Separator (new)
- [ ] Skeleton (new)
- [ ] Toast (already exists)

### Custom Components to Build

#### 1. WeekSelector
```tsx
<WeekSelector
  selectedWeek="2025-01-13"
  onChange={(week) => handleWeekChange(week)}
  minWeek="2025-01-01"
  maxWeek="2025-12-31"
/>
```

#### 2. ShiftCard
```tsx
<ShiftCard
  shift={shiftData}
  onEdit={() => handleEdit(shift.id)}
  onDelete={() => handleDelete(shift.id)}
  showViolations={true}
/>
```

#### 3. StaffAvatar
```tsx
<StaffAvatar
  staffName="Brendon Gan-Le"
  size="sm"
  showName={true}
/>
```

#### 4. ConstraintBadge
```tsx
<ConstraintBadge
  type="hard"
  message="Missing keys"
  severity={100}
/>
```

#### 5. RosterCalendarGrid
```tsx
<RosterCalendarGrid
  weekStart="2025-01-13"
  shifts={shiftsData}
  onShiftClick={(shift) => handleShiftClick(shift)}
  editable={true}
/>
```

---

## Responsive Design Considerations

### Desktop (≥1024px)
- Full calendar grid (7 columns)
- Side-by-side staff summary and violations
- Inline editing with dialogs

### Tablet (768px - 1023px)
- Compact calendar grid (scrollable if needed)
- Stacked staff summary and violations
- Full-featured editing

### Mobile (<768px)
- List view instead of grid
- Swipeable day cards
- Bottom sheet dialogs for editing
- Simplified violation view

---

## User Permissions

### Admin Role Required
All Phase 3 features require admin role:
- Generate rosters
- Edit shifts manually
- Create/edit scheduling rules
- Manage shift requirements
- View all staff schedules

### Staff Role (Future)
Read-only access to:
- View own schedule
- View own hours summary
- Submit availability preferences

---

## Implementation Phases

### Phase 3.1: Core Calendar View (Week 1)
- [ ] Create `/staff/roster/calendar` page
- [ ] Build `RosterCalendarGrid` component
- [ ] Build `ShiftCard` component
- [ ] Fetch shifts from `/api/roster/shifts`
- [ ] Basic navigation (previous/next week)

### Phase 3.2: Generation Dashboard (Week 1)
- [ ] Create `/staff/roster/generate` page
- [ ] Build generation options panel
- [ ] Integrate with `/api/roster/generate`
- [ ] Display results summary
- [ ] Add save functionality

### Phase 3.3: Manual Editing (Week 2)
- [ ] Build shift edit dialog
- [ ] Implement `/api/roster/shifts/:id` endpoints
- [ ] Add drag-and-drop staff reassignment
- [ ] Validation on manual edits

### Phase 3.4: Rules Manager (Week 2)
- [ ] Create `/staff/roster/rules` page
- [ ] Build rule creation dialog
- [ ] Integrate Claude API for parsing
- [ ] CRUD operations for rules

### Phase 3.5: Advanced Features (Week 3)
- [ ] Violations viewer
- [ ] Shift requirements editor
- [ ] Staff hours summary
- [ ] CSV export functionality
- [ ] Print-friendly views

---

## Testing Strategy

### Unit Tests
- Component rendering (Jest + React Testing Library)
- API endpoint responses
- Constraint validation logic
- Date/time calculations

### Integration Tests
- End-to-end roster generation flow
- Rule creation and application
- Shift editing and saving
- Calendar navigation

### Manual Testing
- Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- Responsive design on various screen sizes
- Accessibility (keyboard navigation, screen readers)
- Performance with large datasets (50+ shifts, 20+ staff)

---

## Success Criteria

Phase 3 is complete when:

✅ **Roster Generation**
- [ ] Admins can generate rosters with custom parameters
- [ ] Results display clearly with violation warnings
- [ ] Generated rosters can be saved to database

✅ **Calendar View**
- [ ] Weekly calendar displays all shifts correctly
- [ ] Shifts are color-coded by type
- [ ] Staff names and times are legible
- [ ] Navigation works smoothly

✅ **Manual Editing**
- [ ] Admins can reassign shifts to different staff
- [ ] Edits are validated against constraints
- [ ] Changes save immediately to database
- [ ] Audit log tracks all manual changes

✅ **Rules Management**
- [ ] Admins can create rules using natural language
- [ ] Rules are parsed and validated correctly
- [ ] Active rules affect roster generation
- [ ] Rules can be edited, deactivated, or deleted

✅ **User Experience**
- [ ] Interface is intuitive (no training needed)
- [ ] Loading states provide feedback
- [ ] Error messages are clear and actionable
- [ ] Responsive design works on mobile and tablet

---

## Technical Stack

### Frontend
- **Framework**: Next.js 15.5.5 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React hooks (useState, useEffect)
- **Date Library**: date-fns
- **HTTP Client**: fetch API

### Backend
- **API**: Next.js API routes
- **Database**: PostgreSQL with connection pooling
- **Services**: RosterDbService, RuleParserService

---

## Risk Assessment

### High Risk
1. **Claude API Rate Limits**: Rule parsing may hit rate limits with many requests
   - Mitigation: Implement request caching and batching

2. **Complex Constraint Logic**: UI may not handle all edge cases
   - Mitigation: Extensive testing with diverse scenarios

### Medium Risk
1. **Performance**: Large rosters (100+ shifts) may be slow to render
   - Mitigation: Virtual scrolling, pagination

2. **Data Consistency**: Manual edits may create conflicts
   - Mitigation: Pessimistic locking, conflict resolution UI

### Low Risk
1. **Browser Compatibility**: Modern CSS features may not work in old browsers
   - Mitigation: Progressive enhancement, polyfills

---

## Estimated Timeline

- **Phase 3.1**: 3-4 days (Calendar View)
- **Phase 3.2**: 2-3 days (Generation Dashboard)
- **Phase 3.3**: 3-4 days (Manual Editing)
- **Phase 3.4**: 2-3 days (Rules Manager)
- **Phase 3.5**: 4-5 days (Advanced Features)

**Total**: 2-3 weeks for complete Phase 3 implementation

---

## Next Steps

1. **User Approval**: Review this plan with stakeholders
2. **UI Mockups**: Create wireframes for key screens
3. **Database Schema**: Finalize and apply new table migrations
4. **Component Development**: Start with RosterCalendarGrid
5. **Iterative Testing**: Test each feature as it's completed

---

**Designed By**: Claude Code
**Approved By**: Pending user review
**Version**: 3.0.0 (Planning)
**Implementation Start**: TBD
