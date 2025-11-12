# AI-Powered Rostering System Design

**Version**: 1.0
**Date**: January 11, 2025
**Status**: Design Complete - Ready for Implementation
**Target Release**: v2.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Rule Management System](#rule-management-system)
5. [Admin UI & Workflows](#admin-ui--workflows)
6. [Staff UI & Workflows](#staff-ui--workflows)
7. [Clock-in/Clock-out Flow](#clock-inout-flow)
8. [Approval Queue & Hour Adjustment](#approval-queue--hour-adjustment)
9. [Airtable Export & Pay Calculation](#airtable-export--pay-calculation)
10. [Integration Points](#integration-points)
11. [Error Handling & Edge Cases](#error-handling--edge-cases)
12. [Technology Stack](#technology-stack)
13. [Implementation Phases](#implementation-phases)

---

## Overview

### Purpose

Automate staff rostering for Sip n Play cafe using AI-powered constraint solving, while tracking actual work hours for payroll calculations. The system reduces manual rostering effort, ensures business rules are followed, and provides transparency to staff about their schedules and pay.

### Key Features

1. **AI Roster Generation**: Constraint solver optimizes weekly schedules based on natural language rules
2. **QR Code Clock-in/out**: Simple attendance tracking with automatic variance detection
3. **Hour Tracking & Payroll**: Automatic calculation of VND pay rates (base, weekend, overtime, holiday)
4. **Availability Management**: Staff mark recurring weekly availability patterns
5. **Shift Swapping**: Auto-approved same-role swaps with admin oversight
6. **Deep Integration**: Points system, Vikunja tasks, Discord notifications

### Success Criteria

- Generate valid roster in <10 seconds for 12 staff × 7 days
- 90%+ rule satisfaction rate on first generation
- Zero missed clock-outs through automated detection
- Daily Airtable export with 100% accuracy
- Staff can mark availability in <2 minutes

---

## System Architecture

### Core Components

**1. Database Layer** (PostgreSQL)
- New tables: `roster_shifts`, `staff_availability`, `roster_rules`, `clock_records`, `shift_swaps`, `roster_notifications`, `roster_holidays`
- Integrates with existing: `staff_list`, `staff_knowledge`
- All times stored in Asia/Ho_Chi_Minh timezone

**2. Rule Management System**
- Admin inputs natural language rules
- Claude API parses to structured constraints
- Stored with weights (0-100) for priority
- Automatic cleanup of expired date-specific rules

**3. Constraint Solver Engine**
- Google OR-Tools for optimization
- Inputs: Staff availability matrix, rules, role requirements
- Outputs: Optimal roster maximizing rule satisfaction
- Hard constraints: Availability (red = unavailable), no double-booking
- Soft constraints: Yellow availability (-20 points), all business rules weighted

**4. Admin Rostering Dashboard** (`/admin/roster`)
- Notification queue (late clock-ins, shift swaps, hour discrepancies)
- Approval queue (15+ min variances requiring decision)
- Quick links to roster generation, rule management, Airtable export
- Summary stats (pending approvals, weekly hours, rule compliance)

**5. QR Code Clock-in System**
- Physical QR code at shop displays `/clock-in` URL
- Requires valid staff login session
- Post-clock-in dialog shows reminders (Vikunja tasks, store notices, shift notes)
- Logs geolocation coordinates (soft accountability)
- Prompts based on time variance (toast/warning/explanation)

**6. Staff Dashboard Integration** (`/staff/dashboard`)
- View assigned shifts (upcoming week/2 weeks)
- Weekly availability editor (recurring pattern)
- Request shift swaps
- Hours worked summary (rostered vs actual, pay breakdown)

**7. Integration Points**
- **Discord**: Two channels (#staff-alerts, #admin-alerts)
- **Airtable**: Daily export of hours with pay calculations
- **Vikunja**: Fetch tasks due today for clock-in reminders
- **Points System**: Award/deduct points based on punctuality
- **Geolocation**: Log coordinates on clock-in/out

---

## Database Schema

### New Tables

#### 1. `roster_shifts`
```sql
CREATE TABLE roster_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_week_start DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  shift_type TEXT NOT NULL, -- 'opening', 'day', 'evening', 'closing'
  staff_id UUID REFERENCES staff_list(id),
  scheduled_start TIME NOT NULL,
  scheduled_end TIME NOT NULL,
  role_required TEXT NOT NULL,
  shift_notes TEXT,
  clock_in_reminder TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roster_shifts_week ON roster_shifts(roster_week_start);
CREATE INDEX idx_roster_shifts_staff ON roster_shifts(staff_id);
```

#### 2. `staff_availability`
```sql
CREATE TABLE staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff_list(id),
  day_of_week TEXT NOT NULL, -- 'Monday', 'Tuesday', etc.
  hour_start INTEGER NOT NULL, -- 8 for 8am
  hour_end INTEGER NOT NULL, -- 14 for 2pm
  availability_status TEXT NOT NULL, -- 'available', 'preferred_not', 'unavailable'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(staff_id, day_of_week, hour_start, hour_end)
);

CREATE INDEX idx_staff_availability_lookup ON staff_availability(staff_id, day_of_week);
```

#### 3. `roster_rules`
```sql
CREATE TABLE roster_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_text TEXT NOT NULL, -- Original natural language
  parsed_constraint JSONB NOT NULL, -- {type, parameters}
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  is_active BOOLEAN DEFAULT true,
  expires_at DATE, -- NULL for permanent rules
  created_by UUID REFERENCES staff_list(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roster_rules_active ON roster_rules(is_active, expires_at);
```

**Rule Types:**
```typescript
type RuleType =
  | 'min_staff' // Minimum staff count for day/shift
  | 'max_staff' // Maximum staff count (budget control)
  | 'staff_hours' // Individual weekly hour targets
  | 'avoid_pairing' // Don't schedule two specific staff together
  | 'role_required' // Must have X staff with specific role
  | 'date_specific'; // One-off requirements for specific dates
```

#### 4. `clock_records`
```sql
CREATE TABLE clock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff_list(id) NOT NULL,
  shift_id UUID REFERENCES roster_shifts(id), -- NULL if unscheduled
  clock_in_time TIMESTAMP NOT NULL,
  clock_out_time TIMESTAMP,
  clock_in_location JSONB, -- {lat, lng, accuracy}
  clock_out_location JSONB,
  rostered_start TIME,
  rostered_end TIME,
  variance_reason TEXT,
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES staff_list(id),
  approved_at TIMESTAMP,
  approved_hours DECIMAL(5,2), -- Admin-approved hours for payment
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clock_records_staff_date ON clock_records(staff_id, clock_in_time);
CREATE INDEX idx_clock_records_approval ON clock_records(requires_approval, approved_by);
```

#### 5. `shift_swaps`
```sql
CREATE TABLE shift_swaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES roster_shifts(id) NOT NULL,
  requesting_staff_id UUID REFERENCES staff_list(id) NOT NULL,
  target_staff_id UUID REFERENCES staff_list(id) NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'auto_approved', 'admin_approved', 'vetoed'
  reason TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES staff_list(id),
  notes TEXT
);

CREATE INDEX idx_shift_swaps_status ON shift_swaps(status);
```

#### 6. `roster_notifications`
```sql
CREATE TABLE roster_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL, -- 'late_clock_in', 'shift_swap', 'hour_adjustment'
  staff_id UUID REFERENCES staff_list(id),
  related_record_id UUID, -- ID of clock_record, shift_swap, etc.
  message TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'info', 'warning', 'requires_action'
  is_cleared BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  cleared_at TIMESTAMP
);

CREATE INDEX idx_roster_notifications_active ON roster_notifications(is_cleared, created_at);
```

#### 7. `roster_holidays`
```sql
CREATE TABLE roster_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  pay_multiplier DECIMAL(3,1) NOT NULL, -- 2.0 or 3.0
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_roster_holidays_dates ON roster_holidays(start_date, end_date);
```

### Updates to Existing Tables

#### `staff_list` (add columns)
```sql
ALTER TABLE staff_list ADD COLUMN base_hourly_rate INTEGER; -- VND (e.g., 28000)
ALTER TABLE staff_list ADD COLUMN discord_username TEXT;
ALTER TABLE staff_list ADD COLUMN has_keys BOOLEAN DEFAULT false;
ALTER TABLE staff_list ADD COLUMN available_roles TEXT[]; -- ['Dealer', 'Senior', 'BG Master']
```

---

## Rule Management System

### Natural Language → Constraint Parsing

**Claude API Integration:**

```javascript
async function parseRule(ruleText) {
  const prompt = `Parse this staff rostering rule into structured constraint:

Rule: "${ruleText}"

Return JSON:
{
  type: "min_staff" | "max_staff" | "staff_hours" | "avoid_pairing" | "role_required" | "date_specific",
  parameters: {...},
  weight: 0-100 (suggest based on criticality)
}

Examples:
- "Monday needs 2 opening staff" → {type: "min_staff", parameters: {day: "Monday", shift: "opening", count: 2}, weight: 85}
- "Phong needs 40 hours per week" → {type: "staff_hours", parameters: {staff_id: "uuid", min_hours: 40}, weight: 80}
- "Don't put Hieu and Nhi together" → {type: "avoid_pairing", parameters: {staff_ids: ["uuid1", "uuid2"]}, weight: 40}
- "Weekend nights need 1 BG Master" → {type: "role_required", parameters: {days: ["Saturday", "Sunday"], shift: "evening", role: "BG Master", count: 1}, weight: 90}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(response.content[0].text);
}
```

**Validation & Confirmation:**

If parsing is ambiguous (missing staff names, unclear dates), Claude API returns:
```json
{
  "needs_clarification": true,
  "question": "Which staff members should be avoided together?",
  "partial_parse": {...}
}
```

Admin sees dialog asking for clarification before storing rule.

### Constraint Solver Implementation

**Using OR-Tools CP-SAT Solver:**

```python
from ortools.sat.python import cp_model

def generate_roster(staff_list, rules, availability, week_start):
    model = cp_model.CpModel()

    # Decision variables: assignments[staff_id][day][shift] = 0 or 1
    assignments = {}
    for staff in staff_list:
        for day in DAYS_OF_WEEK:
            for shift in SHIFT_TYPES:
                var_name = f'{staff.id}_{day}_{shift}'
                assignments[(staff.id, day, shift)] = model.NewBoolVar(var_name)

    # HARD CONSTRAINTS (must be satisfied)

    # 1. Red availability = unavailable (cannot assign)
    for (staff_id, day, shift) in assignments:
        if availability[(staff_id, day, shift)] == 'unavailable':
            model.Add(assignments[(staff_id, day, shift)] == 0)

    # 2. No overlapping shifts for same staff
    for staff_id in staff_list:
        for day in DAYS_OF_WEEK:
            for shift1, shift2 in get_overlapping_shifts():
                model.Add(
                    assignments[(staff_id, day, shift1)] +
                    assignments[(staff_id, day, shift2)] <= 1
                )

    # 3. Key holder on opening/closing shifts
    for day in DAYS_OF_WEEK:
        key_holders_opening = [
            assignments[(s.id, day, 'opening')]
            for s in staff_list if s.has_keys
        ]
        model.Add(sum(key_holders_opening) >= 1)

        key_holders_closing = [
            assignments[(s.id, day, 'closing')]
            for s in staff_list if s.has_keys
        ]
        model.Add(sum(key_holders_closing) >= 1)

    # SOFT CONSTRAINTS (weighted objective)
    objective_terms = []

    # Yellow availability: -20 points per assignment
    for (staff_id, day, shift), var in assignments.items():
        if availability[(staff_id, day, shift)] == 'preferred_not':
            objective_terms.append(var * -20)

    # Apply business rules by weight
    for rule in rules:
        if not rule.is_active:
            continue

        if rule.type == 'min_staff':
            # Add bonus for meeting minimum
            relevant_assignments = [
                assignments[(s.id, rule.day, rule.shift)]
                for s in staff_list
            ]
            staff_count = sum(relevant_assignments)
            # Penalize if below minimum
            model.Add(staff_count >= rule.count).OnlyEnforceIf(
                model.NewBoolVar(f'min_staff_{rule.id}')
            )
            objective_terms.append(
                model.NewBoolVar(f'min_staff_{rule.id}') * rule.weight
            )

        elif rule.type == 'avoid_pairing':
            # Penalize if both assigned to same shift
            staff1_id, staff2_id = rule.staff_ids
            for day in DAYS_OF_WEEK:
                for shift in SHIFT_TYPES:
                    both_assigned = model.NewBoolVar(f'avoid_{rule.id}_{day}_{shift}')
                    model.AddMultiplicationEquality(
                        both_assigned,
                        [
                            assignments[(staff1_id, day, shift)],
                            assignments[(staff2_id, day, shift)]
                        ]
                    )
                    objective_terms.append(both_assigned * -rule.weight)

        elif rule.type == 'staff_hours':
            # Award points for meeting weekly hour target
            total_hours = sum(
                assignments[(rule.staff_id, day, shift)] * shift_duration(shift)
                for day in DAYS_OF_WEEK
                for shift in SHIFT_TYPES
            )
            meets_target = model.NewBoolVar(f'hours_{rule.id}')
            model.Add(total_hours >= rule.min_hours).OnlyEnforceIf(meets_target)
            objective_terms.append(meets_target * rule.weight)

        # ... handle other rule types

    # Maximize total satisfaction
    model.Maximize(sum(objective_terms))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        return extract_roster_from_solution(solver, assignments, rules)
    else:
        return {
            'error': 'No valid roster found',
            'violated_constraints': identify_conflicts(model, rules, availability)
        }
```

### Automatic Rule Cleanup

**Daily Cron Job** (midnight Sunday):

```javascript
async function cleanupExpiredRules() {
  const expiredRules = await db.query(`
    SELECT id, rule_text, expires_at
    FROM roster_rules
    WHERE expires_at < NOW() AND is_active = true
  `);

  for (const rule of expiredRules) {
    await db.query(
      `UPDATE roster_rules SET is_active = false WHERE id = $1`,
      [rule.id]
    );

    // Create admin notification (not Discord)
    await createNotification({
      type: 'rule_expired',
      message: `Rule auto-deactivated: "${rule.rule_text}"`,
      severity: 'info'
    });
  }

  console.log(`Deactivated ${expiredRules.length} expired rules`);
}
```

---

## Admin UI & Workflows

### Main Dashboard (`/admin/roster`)

Central hub with notification queue, quick stats, and action buttons.

**Key Sections:**
1. **Notification Queue**: Late/early clock-ins, auto-approved shift swaps, missing clock-outs
2. **Approval Queue**: Hour adjustments requiring admin decision (15+ min variance)
3. **Quick Stats**: Pending approvals count, upcoming roster status, weekly hour totals
4. **Quick Actions**: Generate roster, view/edit roster, manage rules, export to Airtable

**Notifications remain until admin clicks "Clear"** - persistent queue model.

### Generate Roster Page (`/admin/roster/generate`)

1. **Select Period**: Radio buttons for "Next Week" or "Next 2 Weeks"
2. **Active Rules Preview**: Shows top 5 rules by weight with [Show All] button
3. **Staff Availability Check**: Warning if any staff have incomplete availability
4. **Generate Button**: Triggers constraint solver

**Post-Generation:**
- Success: Show rule satisfaction % (e.g., "94% - 14/15 rules met")
- Show which rules were violated with explanation
- Options: [View & Edit Roster] [Regenerate] [Discard]

### Roster Editor (`/admin/roster/edit/[week]`)

**Grid Layout** (inspired by Homebase):
- Rows: Staff members (show name, hours total, pay total)
- Columns: Days of week (Mon-Sun)
- Cells: Shift blocks with time + role (click to edit)

**Features:**
- Click shift block → Opens edit dialog (time, role, shift notes, clock-in reminder)
- Click empty cell → Add shift dialog (select staff, time, role)
- Drag shift block to move between days/staff
- Delete button (🗑️) on each shift
- Duplicate button (📋) to copy shift to other days
- Color-coded by role (like Homebase)
- Yellow warning (⚠️) on shifts where staff marked "preferred_not"
- Bottom row shows daily totals (staff count, total hours)

**Actions:**
- [Save Draft] - Save without publishing
- [Publish Roster] - Finalize and send Discord notification to #staff-alerts
- [Delete All] - Clear entire roster to start from scratch

### Rule Management Page (`/admin/roster/rules`)

**Chat-Style Input:**
```
💬 Add New Rule:
┌─────────────────────────────────────────────────┐
│ Type rule in natural language...                 │
│ e.g., "Fridays need 3 staff for evening shift"   │
└─────────────────────────────────────────────────┘
[Parse Rule]
```

**After parsing, show confirmation:**
```
✓ Parsed Rule:
Minimum 3 staff on Friday evening shift
Weight: 85 (High Priority)
Expires: Never

[Adjust Weight] [Edit] [Save] [Cancel]
```

**Active Rules List:**
- Each rule shows: text, weight, expiry date
- Actions: [Edit Weight] [Deactivate] [Delete]
- Drag-to-reorder for visual priority (doesn't change weights, just for admin reference)

**Inactive Rules:**
- Collapsed section with [Show] button
- Can reactivate expired rules

### Staff Payroll Configuration (`/admin/roster/staff-config`)

List view of all staff with:
- Base hourly rate (VND) with [Edit] button
- Calculated rates displayed (weekend 1.5x, overtime 2x, weekend overtime 3x)
- Available roles (array)
- Has keys (checkbox)
- Discord username
- Active status

**Edit dialog:**
- Base rate input (formats as "28.000 VND")
- Multi-select for available roles
- Keys checkbox
- Discord username text input
- Active/inactive toggle

### Holiday Configuration (`/admin/roster/holidays`)

List of holiday periods with:
- Holiday name
- Date range (start - end)
- Pay multiplier (2x or 3x radio buttons)
- [Edit] [Delete] buttons

**Add Holiday:**
- Name input
- Date range picker
- Multiplier selection (2x or 3x)
- Validates no overlapping holidays

### Manual Pay Adjustments (`/admin/roster/adjustments`)

Form to add commissions, bonuses, deductions:
- Staff member dropdown
- Date range selector
- Adjustment type (radio: Commission / Bonus / Deduction)
- Amount input (VND format: "150.000 VND")
- Reason textarea
- [Add Adjustment] button

Recent adjustments list below with [Edit] [Delete] options.

**Integration:**
- Adjustments stored in new table `pay_adjustments`
- Exported to Airtable with daily hours export
- Visible in staff dashboard pay breakdown

---

## Staff UI & Workflows

### Dashboard Integration (`/staff/dashboard`)

Add new sections to existing staff dashboard:

**1. Your Schedule**
- Next shift card (date, time, role, shift notes)
- This week's shifts list (all days)
- Total hours for week
- [Request Shift Swap] [Download Schedule] buttons

**2. Hours & Pay (Current Month)**
- Rostered Hours vs Actual Hours
- Breakdown: Base Pay, Overtime Pay, Bonuses, Deductions
- Total estimated pay
- [View Detailed Breakdown] button

**3. Your Availability**
- Summary of current weekly pattern
- Highlights any yellow (preferred not) or red (unavailable) days
- [Edit Availability] [Mark One-Time Unavailable] buttons

**4. Pending Shift Swaps**
- List of active swap requests with status
- [View Details] button for each

### Edit Availability Page (`/staff/availability`)

**Mobile-first 7-day grid:**

```
Tap any hour to cycle: 🟢 Green → 🟡 Yellow → 🔴 Red

       Mon   Tue   Wed   Thu   Fri   Sat   Sun
 8am   🟢    🟢    🟢    🟢    🟢    🟢    🟢
 9am   🟢    🟢    🟢    🟢    🟢    🟢    🟢
10am   🟢    🟢    🟢    🟢    🟢    🟢    🟢
...
10pm   🟢    🟢    🟢    🟢    🟢    🟢    🔴
11pm   🟢    🟢    🟢    🟢    🟢    🟢    🔴
12am   🟢    🟢    🟢    🟢    🟢    🟢    🔴
 1am   🟢    🟢    🟢    🟢    🟢    🟢    🔴
 2am   🟢    🟢    🟢    🟢    🟢    🟢    🔴

[Fill All Green] [Fill All Red] [Reset to Default]
[Save Changes]
```

**Implementation:**
- Hours from 8am to 2am (next day)
- Touch-optimized tap targets (minimum 44×44 px)
- Visual feedback on tap (brief animation)
- Changes saved as recurring weekly pattern
- Persists until staff changes it again

### Mark One-Time Unavailable (`/staff/availability/one-time`)

**Form:**
- Date picker (minimum 7 days in advance)
- Time range (optional - defaults to all day)
- Reason textarea
- [Submit] button

**Validation:**
- If date is <7 days away: Show error "Requires 7 days notice"
- If date conflicts with rostered shift: Show warning + create admin notification

**Result:**
- Creates special override record (linked to specific date, not recurring pattern)
- Discord alert to admin if affects existing roster

### Request Shift Swap (`/staff/shift-swap/request`)

**Flow:**
1. Select one of your upcoming shifts (dropdown)
2. Select target staff member (dropdown - filtered by same role)
3. Shows availability indicator (✅ Available / ⚠️ Already scheduled)
4. Optional reason textarea
5. [Submit Request] button

**Post-submission:**
- Same role + 72+ hours advance: Auto-approved immediately
- Same role + <72 hours: Pending admin approval
- Different role: Always pending admin approval
- Discord notification sent to #staff-alerts (if auto-approved) or #admin-alerts (if pending)

**Swap Status:**
- Visible in dashboard "Pending Shift Swaps" section
- Shows status: Auto-approved / Pending / Vetoed
- If vetoed, shows admin reason

---

## Clock-in/Out Flow

### QR Code Setup

**Physical QR Code:**
- Generates URL: `https://sipnplay.cafe/clock-in`
- Printed and displayed at shop entrance/staff area
- No expiration, no tokens - simple permanent URL
- Security: Requires valid staff login session

### Clock-in Flow

**Step 1: Scan QR Code** (`/clock-in`)

System detects logged-in staff, checks clock status:

**If not clocked in:**
```
Welcome, Phong Chu!

Current Status: ⚪ Not Clocked In

Your Next Shift:
Today, 12:30pm - 6:00pm (Senior)
📝 Note: Training new staff member

[Clock In Now]
```

**If already clocked in:**
```
Hello, Phong Chu!

Current Status: 🟢 Clocked In
Started: 12:28pm (5 hours 47 min ago)
Scheduled End: 6:00pm

[Clock Out Now]
```

### Clock-in Validation & Prompts

**On-time (±5 min):**
```
Clocked In Successfully! ✅

Time: 12:28pm (2 min early)
📍 Location logged
⭐ +20 points (On-time arrival)

📋 Reminders for your shift:
☐ Vikunja: Clean game shelves (due today)
☐ Store Notice: 50-person booking at 7pm
☐ Shift Note: Training new staff member

[✓ Acknowledge All] (required to continue)
```

**Late 5-15 min:**
```
Clocked In - Running Late ⚠️

Time: 12:42pm (12 min late)
Scheduled: 12:30pm
📍 Location logged

⚠️ This late arrival has been noted.

Repeated late arrivals may result in point
deductions. Please try to arrive on time.

📋 Reminders for your shift:
[... same as above ...]

[Acknowledge]
```

**Late 15+ min:**
```
Late Arrival - Explanation Required ⛔

Time: 12:52pm (22 min late)
Scheduled: 12:30pm
📍 Location logged
⭐ -100 points (Late arrival)

Please explain why you were late:
┌─────────────────────────────────────────┐
│                                          │
│                                          │
└─────────────────────────────────────────┘

This will be reviewed by admin.

[Submit & Continue to Reminders]
```

**Early clock-in (5-15 min):**
```
Clocked In Early ✅

Time: 12:18pm (12 min early)
Scheduled: 12:30pm
📍 Location logged
⭐ +50 points (Early arrival)

📋 Reminders for your shift:
[...]
```

### Clock-out Validation & Prompts

**On-time (±5 min):**
```
Clocked Out Successfully! ✅

Clock In:  12:28pm
Clock Out: 6:03pm
Duration:  5 hours 35 min

⭐ +20 points (On-time clock-out)

Have a great rest of your day! 👋

[Close]
```

**Late 5-15 min:**
```
Clock Out - Running Late

Clock Out: 6:12pm (12 min late)
Scheduled End: 6:00pm

Why are you clocking out late?
○ Forgot to clock out earlier
○ Was helping out (voluntary)
○ Finishing up tasks

[Submit]

Your response will be logged.
```

**Late 15+ min (affects pay):**
```
Clock Out - Overtime/Late Hours

Clock Out: 6:45pm (45 min late)
Scheduled End: 6:00pm
Extra Time: 45 minutes

This will affect your paid hours.
Please select the reason:

○ Approved overtime work
  → Hours will be paid as overtime

○ Was helping out (voluntary)
  → Hours recorded but not paid
  → ⭐ +100 points (Voluntary contribution)

○ Customers stayed late past closing
  → Requires admin approval for payment

○ Forgot to clock out (actual end time was _____)
  → Enter actual time: [____]

[Submit]
```

### Missing Clock-out Detection

**Cron job at 9am next day:**
- Checks for clock-ins >18 hours old with no clock-out
- Creates pending approval record
- Discord alert to #admin-alerts:

```
🚨 Missing Clock-Out

@phongchu clocked in yesterday at 12:28pm but never clocked out

Last scheduled shift: 12:30pm - 6:00pm

@phongchu - Please confirm your actual clock-out time
Admin: Review here https://sipnplay.cafe/admin/roster/approvals
```

**Admin can:**
- Manually set clock-out time based on rostered hours
- Contact staff for clarification
- Adjust hours in approval queue

---

## Approval Queue & Hour Adjustment

### Approval Queue UI (`/admin/roster/approvals`)

**Filter tabs:**
- [All] [Overtime] [Late Clock-in] [Late Clock-out] [Missing Clock-out]

**Each approval card shows:**

```
Phong Chu - Mon, Dec 18
─────────────────────────────────────
Rostered:  12:30pm - 6:00pm (5.5 hrs)
Actual:    12:28pm - 6:45pm (6.25 hrs)
Variance:  -2 min in, +45 min out

Clock-out reason: "Approved overtime work"
📍 Location: Verified (shop)

Adjustment Options:
○ Pay rostered hours only (5.5 hrs)
● Pay overtime (6.25 hrs, +0.75 overtime @ 3x weekend rate)
○ Custom hours: [____] hrs

Calculated Pay:
- Regular: 5.5 hrs × 42.000 VND = 231.000 VND
- Overtime: 0.75 hrs × 84.000 VND = 63.000 VND
- Total: 294.000 VND

Admin Note (optional):
┌───────────────────────────────────┐
│                                    │
└───────────────────────────────────┘

[Approve] [Deny & Use Rostered Hours]
```

**Auto-approval rules:**
- ≤5 min variance: Auto-approve rostered hours, no admin review
- 5-15 min variance: Auto-approve rostered hours, log for reference
- 15+ min variance: Requires admin approval

**Batch actions:**
- [Approve All] - Approves all pending with default selections
- [Export Approved to Airtable] - Manual trigger for approved records

### Pay Calculation Logic

**VND Pay Rates:**

```javascript
function calculatePay(clockRecord, staff, shift) {
  const baseRate = staff.base_hourly_rate; // e.g., 28000
  const dayType = getDayType(shift.date); // 'weekday', 'weekend', 'holiday'
  const approvedHours = clockRecord.approved_hours || shift.scheduled_hours;
  const overtimeHours = clockRecord.approved_overtime_hours || 0;

  let pay = {
    regular: 0,
    weekend: 0,
    overtime: 0,
    weekend_overtime: 0,
    holiday: 0
  };

  if (dayType === 'holiday') {
    const holidayMultiplier = getHolidayMultiplier(shift.date); // 2 or 3
    pay.holiday = approvedHours * baseRate * holidayMultiplier;

    if (overtimeHours > 0) {
      pay.holiday += overtimeHours * baseRate * holidayMultiplier;
    }
  } else if (dayType === 'weekend') {
    pay.weekend = approvedHours * baseRate * 1.5;

    if (overtimeHours > 0) {
      pay.weekend_overtime = overtimeHours * baseRate * 3; // Not 1.5 * 2, just 3
    }
  } else {
    pay.regular = approvedHours * baseRate;

    if (overtimeHours > 0) {
      pay.overtime = overtimeHours * baseRate * 2;
    }
  }

  // Add manual adjustments (commissions, bonuses, deductions)
  const adjustments = await getPayAdjustments(staff.id, shift.date);

  return {
    breakdown: pay,
    adjustments: adjustments,
    total: Object.values(pay).reduce((a, b) => a + b, 0) +
           adjustments.reduce((a, b) => a + b.amount, 0)
  };
}

function getDayType(date) {
  // Check holidays first
  const holiday = await db.query(`
    SELECT pay_multiplier FROM roster_holidays
    WHERE $1 BETWEEN start_date AND end_date
  `, [date]);

  if (holiday.rows.length > 0) return 'holiday';

  // Check weekend (Saturday = 6, Sunday = 0)
  const day = new Date(date).getDay();
  if (day === 0 || day === 6) return 'weekend';

  return 'weekday';
}
```

**VND Formatting:**
```javascript
function formatVND(amount) {
  return amount.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).replace(/,/g, '.') + ' VND';
}

// Example: 294000 → "294.000 VND"
```

---

## Airtable Export & Pay Calculation

### Daily Export Cron Job

**Runs at 11:59pm daily** (`/api/cron/export-hours-to-airtable`):

1. Fetch all approved clock records from today
2. Calculate pay for each record
3. Fetch manual adjustments (commissions, bonuses, deductions)
4. Create/update Airtable records
5. Send Discord notification to #admin-alerts

### Airtable Table Structure

**Table: `Staff Hours`** (in existing base or new "Payroll" base)

Columns:
- Staff Name (Link to Staff List)
- Date (Date field)
- Day Type (Single select: Weekday/Weekend/Holiday)
- Rostered Hours (Number)
- Actual Hours (Number)
- Variance (Formula: `{Actual Hours} - {Rostered Hours}`)
- Clock In Time (DateTime)
- Clock Out Time (DateTime)
- Regular Hours (Number)
- Weekend Hours (Number)
- Overtime Hours (Number)
- Weekend Overtime Hours (Number)
- Holiday Hours (Number)
- Reason/Notes (Long text)
- Base Pay (Currency VND)
- Weekend Pay (Currency VND)
- Overtime Pay (Currency VND)
- Weekend Overtime Pay (Currency VND)
- Holiday Pay (Currency VND)
- Bonuses (Currency VND)
- Deductions (Currency VND)
- Total Pay (Formula: Sum of all pay columns)
- Admin Approved (Checkbox)
- Approved By (Text)
- Export Date (DateTime)

### Export Logic

```javascript
async function exportHoursToAirtable() {
  const today = new Date();
  const records = await db.query(`
    SELECT
      cr.*,
      s.name as staff_name,
      s.base_hourly_rate,
      rs.scheduled_start,
      rs.scheduled_end,
      rs.day_of_week
    FROM clock_records cr
    JOIN staff_list s ON cr.staff_id = s.id
    LEFT JOIN roster_shifts rs ON cr.shift_id = rs.id
    WHERE DATE(cr.clock_in_time) = $1
    AND cr.approved_by IS NOT NULL
  `, [today]);

  for (const record of records) {
    const payBreakdown = await calculatePay(record);
    const adjustments = await getPayAdjustments(record.staff_id, today);

    const airtableRecord = {
      'Staff Name': [record.staff_name],
      'Date': record.clock_in_time.toISOString().split('T')[0],
      'Day Type': payBreakdown.dayType,
      'Rostered Hours': record.rostered_hours,
      'Actual Hours': record.actual_hours,
      'Clock In Time': record.clock_in_time.toISOString(),
      'Clock Out Time': record.clock_out_time?.toISOString(),
      'Regular Hours': payBreakdown.hours.regular || 0,
      'Weekend Hours': payBreakdown.hours.weekend || 0,
      'Overtime Hours': payBreakdown.hours.overtime || 0,
      'Weekend Overtime Hours': payBreakdown.hours.weekend_overtime || 0,
      'Holiday Hours': payBreakdown.hours.holiday || 0,
      'Reason/Notes': record.variance_reason,
      'Base Pay': payBreakdown.breakdown.regular,
      'Weekend Pay': payBreakdown.breakdown.weekend,
      'Overtime Pay': payBreakdown.breakdown.overtime,
      'Weekend Overtime Pay': payBreakdown.breakdown.weekend_overtime,
      'Holiday Pay': payBreakdown.breakdown.holiday,
      'Bonuses': adjustments.bonuses,
      'Deductions': adjustments.deductions,
      'Admin Approved': true,
      'Approved By': record.approver_name,
      'Export Date': new Date().toISOString()
    };

    await airtable.create('Staff Hours', airtableRecord);
  }

  // Send Discord notification
  await sendDiscordWebhook(ADMIN_ALERTS_CHANNEL, {
    content: `✅ Daily Hours Exported to Airtable\n\nDate: ${formatDate(today)}\nRecords exported: ${records.length}\nTotal hours: ${calculateTotalHours(records)}\nPending approvals: ${await getPendingApprovalsCount()}`
  });
}
```

### Manual Export Options

Admin dashboard provides buttons for:
- **Export Today**: Manual trigger for today's approved hours
- **Export Date Range**: Select custom date range (date picker)
- **Export Specific Staff**: Filter by staff member
- **Re-export Corrected**: Re-export records that were adjusted after initial export

All exports append to Airtable (create new records), never overwrite existing records. This maintains audit trail.

---

## Integration Points

### Discord Webhooks

**Two Channels:**

1. **#staff-alerts** (`DISCORD_STAFF_ALERTS_WEBHOOK_URL`):
   - Roster published
   - Shift swaps (auto-approved or admin-approved)
   - Missing clock-outs (mentions staff + admin)

2. **#admin-alerts** (`DISCORD_ADMIN_ALERTS_WEBHOOK_URL`):
   - Late clock-ins (5+ min)
   - Overtime requests
   - Daily hours exported
   - Unscheduled clock-ins

**Webhook Format:**

```javascript
await sendDiscordWebhook(channel, {
  content: `🔄 Shift Swap Auto-Approved\n\n${staff1.discord_username} ↔ ${staff2.discord_username}\nMonday, Dec 18 | 10am-6pm | Dealer role\n\nRequested 72 hours in advance (same role swap)\n\n${staff1.discord_username} ${staff2.discord_username} - Swap confirmed!`
});
```

**Rate Limiting:**
- Maximum 1 webhook per minute
- Batch multiple notifications if triggered simultaneously

### Vikunja Integration

**Clock-in Dialog Task Fetching:**

```javascript
async function getClockInReminders(staffId) {
  const reminders = [];

  // 1. Fetch Vikunja tasks due today
  const vikunjaUserId = await getVikunjaUserId(staffId);
  if (vikunjaUserId) {
    const tasks = await vikunjaService.getUserTasks(vikunjaUserId, {
      filter: 'due_date <= today',
      status: 'incomplete'
    });

    reminders.push(...tasks.map(t => ({
      type: 'vikunja_task',
      text: `${t.title} (due ${formatDate(t.due_date)})`,
      link: `https://tasks.sipnplay.cafe/tasks/${t.id}`
    })));
  }

  // 2. Fetch store-wide notifications (from database or Discord channel)
  const storeNotices = await getStoreNotifications();
  reminders.push(...storeNotices);

  // 3. Fetch shift-specific notes from roster
  const shift = await getCurrentShift(staffId);
  if (shift?.clock_in_reminder) {
    reminders.push({
      type: 'shift_note',
      text: shift.clock_in_reminder,
      link: null
    });
  }

  return reminders;
}
```

**Store Notifications:**
- Stored in new table `store_notifications` with start_date/end_date
- Admin can create via `/admin/roster/store-notices` page
- Supports one-time or recurring notices
- Can target specific staff or "all staff"

### Points System Integration

**Automatic Point Awards/Deductions:**

```javascript
// Clock-in points
if (variance >= -15 && variance <= -5) {
  await awardPoints(staff.id, 50, 'Early clock-in (5-15 min)');
} else if (variance >= -5 && variance <= 5) {
  await awardPoints(staff.id, 20, 'On-time clock-in');
} else if (variance > 5 && variance <= 15) {
  // First time: Warning only
  const recentLateCount = await getRecentLateClockIns(staff.id, 30); // Last 30 days
  if (recentLateCount > 0) {
    await deductPoints(staff.id, 50, 'Late clock-in (5-15 min, repeat offense)');
  }
} else if (variance > 15) {
  await deductPoints(staff.id, 100, 'Late clock-in (15+ min)');
}

// Clock-out points (voluntary overtime)
if (reason === 'voluntary_help' && extraHours > 0) {
  await awardPoints(staff.id, extraHours * 100, `Voluntary overtime (${extraHours} hrs)`);
}

// Weekly/monthly bonuses (via cron)
const perfectWeek = await checkPerfectWeek(staff.id);
if (perfectWeek) {
  await awardPoints(staff.id, 200, 'Perfect week - no late arrivals');
}

const zeroForgotten = await checkForgottenClockouts(staff.id, 'month');
if (zeroForgotten) {
  await awardPoints(staff.id, 150, 'Zero forgotten clock-outs this month');
}

// Shift swap planning bonus
const hoursBefore = differenceInHours(shift.date, swapRequest.requested_at);
if (hoursBefore >= 72) {
  await awardPoints(staff.id, 30, 'Shift swap requested 72+ hours in advance');
} else if (hoursBefore < 24) {
  await deductPoints(staff.id, 50, 'Last-minute shift swap (<24 hours)');
}
```

**Points Config Integration:**

Add rostering-related point rules to existing `/admin/points-config` page:
- Early clock-in: +50 points
- On-time clock-in: +20 points
- Perfect week: +200 points
- Voluntary overtime: +100 points/hour
- Late 5-15 min (repeat): -50 points
- Late 15+ min: -100 points
- Forgotten clock-out: -30 points
- Late shift swap: -50 points

Admin can adjust these values in points config UI.

### Geolocation Logging

**Browser Geolocation API:**

```javascript
async function clockIn(staffId) {
  // Request location (graceful fallback if denied)
  let location = null;

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    });

    location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
  } catch (error) {
    console.warn('Geolocation denied or unavailable:', error);
    // Continue with clock-in without location
  }

  // Save clock record with location
  await db.query(`
    INSERT INTO clock_records (staff_id, clock_in_time, clock_in_location)
    VALUES ($1, NOW(), $2)
  `, [staffId, JSON.stringify(location)]);
}
```

**Admin Viewing:**
- Approval queue shows location as simple lat/lng coordinates
- Optional: Future enhancement to show map view (Google Maps embed)
- Primary purpose: Soft accountability, not enforcement

---

## Error Handling & Edge Cases

### 1. No Clock-out Scenario
- **Detection**: Cron job at 9am checks for clock-ins >18 hours old
- **Action**: Discord alert to staff + admin, create pending approval
- **Admin UI**: "Missing clock-out" in approval queue with manual time entry
- **Fallback**: If no response in 24 hours, use rostered end time

### 2. Double Clock-in
- **Prevention**: Check for active clock-in before allowing new one
- **UI**: Error message "Already clocked in at [time]. Clock out first?"
- **Admin Override**: Can manually close previous session

### 3. Clock-in Without Roster
- **Scenario**: Staff clocks in on unscheduled day
- **Action**: Allow clock-in, create "unscheduled shift" record
- **Notification**: Discord to #admin-alerts "Unscheduled clock-in: @staff"
- **Admin**: Approve/deny hours in approval queue

### 4. QR Code Security
- **Validation**: Requires valid staff login session (checks `staff_id` in session)
- **Session timeout**: 4 hours of inactivity
- **No spoofing**: Can't clock in for another staff member

### 5. Staff Marks Unavailable on Rostered Shift
- **Detection**: When updating availability, check for conflicts
- **Action**: Create admin notification in queue
- **Discord**: Alert to #admin-alerts with staff mention
- **Admin**: Must manually adjust roster or contact staff

### 6. Roster Generation Fails
- **Scenario**: Constraint solver can't find solution
- **UI Error**: Show detailed conflicts:
  - "Monday: Only 1 staff available, need minimum 2"
  - "Friday: No BG Master available"
- **Action**: Admin must relax rules (lower weights) or request more staff availability

### 7. Multiple Staff Swap Same Shift
- **Prevention**: Lock shift once swap is pending
- **UI**: Show "Swap pending" badge, disable swap button
- **Resolution**: First approved swap wins, others rejected

### 8. Holiday Pay Rate Missing
- **Scenario**: Staff works on date that should be holiday but not configured
- **Fallback**: Use weekend rate (1.5x) temporarily
- **Alert**: Discord to #admin-alerts "Holiday rate missing for [date]"
- **Admin**: Can retroactively set holiday and re-export

### 9. Airtable Export Failure
- **Retry**: Automatic 3 retries with exponential backoff
- **Notification**: Discord alert + create admin notification
- **Fallback**: Data in PostgreSQL, manual re-export available

### 10. Shift Overlap Conflict
- **Validation**: Check for overlaps before saving roster
- **UI**: Error "Conflict: Staff already scheduled 12pm-6pm"
- **Prevention**: Visual indicator in roster editor (highlighted cells)

### 11. Timezone Consistency
- **Standard**: All times stored as Asia/Ho_Chi_Minh throughout
- **Database**: Use `TIMESTAMP` without timezone conversion
- **Airtable**: Export as local Vietnam time
- **Display**: No conversion needed, always Vietnam time

### 12. Staff Role Change Mid-Week
- **Handling**: Only apply to future rosters
- **Current Week**: Keep existing role for published shifts
- **Notification**: Admin warning "Role change applies to next roster"

---

## Technology Stack

### Backend
- **Framework**: Next.js 14 (App Router) - existing
- **Database**: PostgreSQL on Railway - existing
- **Constraint Solver**: Google OR-Tools
  - Option 1: Python subprocess from Node API route
  - Option 2: `@google-cloud/optimization` npm package (if available)
- **LLM**: Anthropic Claude API (existing key)
- **Cron Jobs**: `node-schedule` npm package

### Frontend
- **Framework**: React + Next.js - existing
- **Components**: shadcn/ui - existing
- **Styling**: Tailwind CSS - existing
- **Icons**: Lucide React - existing
- **Mobile**: Mobile-first responsive design

### External Services
- **Discord**: Webhooks (2 channels)
- **Airtable**: REST API via existing services
- **Vikunja**: REST API via existing service
- **Geolocation**: Browser API (built-in)

### New Dependencies

```json
{
  "dependencies": {
    "node-schedule": "^2.1.0",
    "date-fns-tz": "^2.0.0"
  },
  "devDependencies": {
    "@types/node-schedule": "^2.1.0"
  }
}
```

**Python OR-Tools** (if using subprocess approach):
```bash
pip install ortools
```

### Database Migrations

**Migration order:**
1. Add columns to `staff_list`
2. Create 7 new tables (roster_shifts, staff_availability, roster_rules, clock_records, shift_swaps, roster_notifications, roster_holidays)
3. Create indexes
4. Seed initial data (holidays, default rules)

**Scripts:**
- `scripts/create-rostering-tables.js`
- `scripts/migrate-staff-pay-rates.js` (add hourly rates, discord usernames)
- `scripts/seed-vietnam-holidays.js` (2025 holidays)

### API Routes Structure

```
app/api/roster/
├── generate/route.ts              # POST - Generate roster via solver
├── [week]/route.ts                # GET/PUT - Get/update roster
├── publish/route.ts               # POST - Publish roster + Discord
├── rules/route.ts                 # GET/POST/PUT/DELETE - Rule management
├── rules/parse/route.ts           # POST - Parse natural language rule
├── approvals/route.ts             # GET/PUT - Hour adjustment queue
├── export-airtable/route.ts       # POST - Manual/auto Airtable export
└── holidays/route.ts              # GET/POST/PUT/DELETE - Holiday config

app/api/clock-in/route.ts          # POST - Clock-in/out action
app/api/staff/availability/route.ts # GET/PUT - Weekly availability
app/api/shift-swap/route.ts        # POST/GET/PUT - Request/approve swaps
app/api/admin/staff-config/route.ts # GET/PUT - Staff pay & roles

app/api/cron/
├── cleanup-expired-rules/route.ts  # Daily midnight Sunday
├── export-hours-to-airtable/route.ts # Daily 11:59pm
└── check-missing-clockouts/route.ts # Daily 9am
```

### Performance Considerations
- **Roster Generation**: <10 seconds for 12 staff × 7 days
- **Availability Queries**: Index on (staff_id, day_of_week)
- **Clock Records**: Index on (staff_id, clock_in_time)
- **Notification Queue**: Index on (is_cleared, created_at)
- **Discord Webhooks**: Rate limit 1/minute, batch if needed

### Security
- **Admin Routes**: `useAdminMode()` hook
- **Staff Routes**: Valid staff session required
- **QR Code**: Session-based authentication
- **API Rate Limiting**: Implement on clock-in endpoint

### Mobile Optimization
- Availability grid: Horizontal scroll, touch-optimized
- Roster editor: Responsive table → card layout on mobile
- Clock-in: Large tap targets (44×44 px minimum)
- Dashboard: Stacked sections on mobile

---

## Implementation Phases

### Phase 1: Database & Core API (Week 1)
- Create all database tables and indexes
- Add columns to `staff_list`
- Build core API routes (roster CRUD, clock-in, availability)
- Set up cron job infrastructure

**Deliverable**: Database schema complete, API endpoints testable via Postman

### Phase 2: Constraint Solver & Rule Management (Week 2)
- Implement OR-Tools constraint solver
- Build Claude API rule parser
- Create rule management API routes
- Test roster generation with sample data

**Deliverable**: Can generate valid roster from command line

### Phase 3: Admin UI (Week 3)
- Build admin dashboard with notification queue
- Create roster editor (Homebase-style grid)
- Implement rule management page
- Build approval queue UI
- Add staff config and holiday config pages

**Deliverable**: Admin can generate, edit, and publish roster

### Phase 4: Staff UI & Clock-in (Week 4)
- Integrate availability editor into staff dashboard
- Build clock-in/out flow with QR code
- Create shift swap request UI
- Add hours/pay display to dashboard

**Deliverable**: Staff can mark availability and clock in/out

### Phase 5: Integration & Validation (Week 5)
- Implement Discord webhooks (both channels)
- Build Airtable export logic
- Integrate Vikunja task fetching
- Add points system integration
- Implement geolocation logging

**Deliverable**: All integrations working end-to-end

### Phase 6: Testing & Refinement (Week 6)
- Test constraint solver with edge cases
- Test all clock-in/out variance scenarios
- Test pay calculations (all rate types)
- Mobile device testing (iOS/Android)
- Load testing with 12 staff × 4 weeks

**Deliverable**: All features tested and bugs fixed

### Phase 7: Deployment & Soft Launch (Week 7)
- Run migrations on production database
- Deploy to Railway
- Create initial roster manually for first week
- Train all staff on new system
- Monitor for issues

**Deliverable**: System live in production

### Phase 8: Iteration & Optimization (Week 8+)
- Gather staff feedback
- Refine constraint solver weights
- Improve roster generation success rate
- Add requested features
- Optimize performance

**Deliverable**: Stable, optimized system

---

## Future Enhancements (Post-MVP)

1. **Mobile Apps**: Native iOS/Android apps with push notifications
2. **Map View**: Show clock-in/out locations on Google Maps in approval queue
3. **Predictive Scheduling**: ML model learns patterns and suggests optimal rosters
4. **Leave Requests**: Formal leave request system with approval workflow
5. **Time-off Balance**: Track vacation days, sick leave, personal days
6. **Performance Analytics**: Staff productivity metrics (hours worked vs tasks completed)
7. **Shift Templates**: Save common roster patterns for quick generation
8. **Multi-location**: Support multiple cafe locations with separate rosters
9. **Payroll Integration**: Direct integration with Vietnamese payroll providers
10. **SMS Notifications**: Alternative to Discord for critical alerts

---

## Success Metrics

**MVP Success Criteria:**

1. **Roster Generation**:
   - 90%+ rule satisfaction on first generation
   - <10 seconds generation time
   - Admin can manually edit to 100% satisfaction in <15 minutes

2. **Clock-in Adoption**:
   - 100% staff use QR code for all shifts within 2 weeks
   - Zero missed clock-outs after first month (with detection system)

3. **Hour Accuracy**:
   - 95%+ of clock records auto-approved (≤5 min variance)
   - <5% of records require manual admin adjustment

4. **Airtable Export**:
   - 100% successful exports (with retry mechanism)
   - Zero manual data entry needed for payroll

5. **User Satisfaction**:
   - Staff can mark availability in <2 minutes
   - Admin rostering time reduced from 2 hours/week to <30 min/week
   - Positive staff feedback on schedule visibility and pay transparency

---

## Appendix

### VND Pay Rate Examples

**Base Rate: 28.000 VND/hour**

| Scenario | Hours | Rate | Calculation | Total |
|----------|-------|------|-------------|-------|
| Weekday regular | 6 | 28.000 | 6 × 28.000 | 168.000 VND |
| Weekend regular | 6 | 42.000 | 6 × 28.000 × 1.5 | 252.000 VND |
| Weekday overtime | 2 | 56.000 | 2 × 28.000 × 2 | 112.000 VND |
| Weekend overtime | 2 | 84.000 | 2 × 28.000 × 3 | 168.000 VND |
| Holiday (2x) | 6 | 56.000 | 6 × 28.000 × 2 | 336.000 VND |
| Holiday (3x) | 6 | 84.000 | 6 × 28.000 × 3 | 504.000 VND |

### Vietnamese Holidays 2025

| Holiday | Dates | Days | Multiplier |
|---------|-------|------|------------|
| Tết (Lunar New Year) | Jan 28 - Feb 3 | 7 | 3x |
| Hung Kings' Day | Apr 18 | 1 | 2x |
| Reunification Day | Apr 30 - May 1 | 2 | 2x |
| Labor Day | May 1 | 1 | 2x |
| National Day | Sep 2 | 1 | 2x |

### Shift Types Reference

| Shift Type | Typical Hours | Purpose |
|------------|---------------|---------|
| Opening | 10am-12pm | Arrive before cafe opens, setup tasks |
| Day | 12pm-6pm | Main daytime coverage |
| Evening | 6pm-10pm | Evening coverage |
| Closing | 10pm-12am | Closing duties, cleanup |

---

**End of Design Document**

**Next Steps:**
1. Review design with stakeholders
2. Confirm all requirements captured
3. Begin Phase 1 implementation (database schema)
4. Set up development worktree
5. Create detailed implementation plan
