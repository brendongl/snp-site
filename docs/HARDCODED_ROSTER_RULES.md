# Hardcoded Roster Rules

**Last Updated:** January 14, 2025
**Version:** 1.10.6

This document lists all **hardcoded rules** in the roster generation system that are NOT part of the natural language rule set. These are business logic constraints enforced by the code itself.

---

## 🔴 HARD CONSTRAINTS (Cannot be violated)

These constraints have severity 100-1000 and will cause the roster to be marked as "Invalid" if violated.

### 1. No Overlapping Shifts
- **Severity:** 1000 (Highest - physically impossible)
- **Rule:** A staff member cannot be assigned to two shifts that overlap in time
- **Example:** Cannot assign Long to both Monday 17:00-00:00 AND Monday 18:00-23:00
- **Location:** `roster-solver-service.ts:500-511`

### 2. Availability Check
- **Severity:** 100
- **Rule:** Staff cannot be assigned to shifts during times marked as "unavailable" in their availability
- **Note:** "preferred_not" is a soft constraint (can be violated with penalty)
- **Location:** `roster-solver-service.ts:513-524`

### 3. Maximum Hours Per Week
- **Default Value:** 40 hours
- **Severity:** 100
- **Rule:** No staff member can work more than the maximum weekly hours
- **Configurable:** Yes (can be set per roster generation request)
- **API Parameter:** `max_hours_per_week` (default: 40)
- **Location:** `roster-solver-service.ts:526-537`

### 4. Role Requirement
- **Severity:** 100
- **Rule:** Staff must have the required role assigned in their profile to work a shift
- **Roles:** `floor`, `cafe` (stored in `staff_list.available_roles`)
- **Note:** This caused the v1.10.6 bug where 6 staff had no roles assigned
- **Location:** `roster-solver-service.ts:539-549`

### 5. Keys Requirement
- **Severity:** 100
- **Rule:** If a shift requires keys (opening/closing), staff must have `has_keys = true` in their profile
- **Shift Types Requiring Keys:** `opening`, `closing`
- **Location:** `roster-solver-service.ts:551-561`

---

## 🟡 SOFT CONSTRAINTS (Can be violated with penalty)

These constraints add penalties to the roster score but don't make it invalid.

### 1. Preferred Not Available
- **Severity:** 30
- **Rule:** Avoid assigning staff to times marked as "preferred_not" in their availability
- **Location:** `roster-solver-service.ts:576-587`

### 2. Fairness Preference
- **Default Value:** true
- **Rule:** When `preferFairness = true`, the algorithm tries to distribute hours evenly among staff
- **Implementation:** Boosts priority for staff with fewer hours assigned
- **API Parameter:** `prefer_fairness` (default: true)
- **Location:** `roster-solver-service.ts:869` (80% threshold check)

---

## ⚙️ SYSTEM DEFAULTS

These are configurable but have hardcoded default values:

| Parameter | Default | Configurable? | Location |
|-----------|---------|---------------|----------|
| `max_hours_per_week` | 40 | Yes (API param) | `generate/route.ts:32` |
| `prefer_fairness` | true | Yes (API param) | `generate/route.ts:33` |
| Week start validation | Must be Monday | No | `generate/route.ts:52` |

---

## 🏗️ ARCHITECTURAL CONSTRAINTS

These are implicit in how the system works:

### 1. Fixed Shift Templates (IDENTIFIED ISSUE)
- **Current Behavior:** Shifts are generated from rules with fixed start/end times
- **Problem:** If a constrained staff member's availability doesn't match the fixed times, they can't be assigned
- **Example:**
  - Rule generates shift: Monday 17:00-00:00
  - Long is available: Monday 18:00-23:00
  - Result: Long cannot be assigned (shift doesn't fit)
- **Solution Needed:** Make shifts flexible/adjustable for constrained staff
- **Status:** 🔴 **BUG** - Prevents "Everyone rostered once per week" rule from working

### 2. Two-Phase Assignment
- **Phase 1:** Assign constrained staff first (staff-first priority)
- **Phase 2:** Fill remaining shifts with flexible staff (greedy algorithm)
- **Note:** Phase 1 currently fails for staff whose availability doesn't match rule-generated shifts

### 3. Retry Logic
- **Attempts:** 3 attempts to generate valid roster
- **On Failure:** Returns best attempt (even if invalid)
- **Location:** `roster-solver-service.ts:147-169`

---

## 📊 CONSTRAINT WEIGHTS (From Natural Language Rules)

For reference, here are the typical weights used in natural language rules:

| Weight | Constraint Type | Example |
|--------|----------------|---------|
| 150 | Critical business rule | Must have keys for opening/closing |
| 100 | Must-satisfy (hard) | Everyone rostered once per week |
| 90 | Strong preference | Min 40 hours for full-time staff |
| 75 | Important preference | Min 40 hours for Thọ and Hiếu |
| 50 | Moderate preference | Max consecutive shifts |
| 30 | Soft preference | Preferred availability |

---

## 🐛 KNOWN ISSUES

### Issue 1: Fixed Shifts Prevent Constrained Staff Assignment
**Status:** 🔴 Active Bug
**Discovered:** v1.10.6 (January 14, 2025)
**Impact:** Staff with limited availability cannot be assigned if their windows don't match rule-generated shift times
**Affected Staff:** Long (11h), An (30h), Vũ (39h), Sơn (51h), Nhi (58h), Ivy (76h)
**Solution:** Make shifts flexible - adjust start/end times to fit constrained staff availability
**Priority:** HIGH (violates Weight 100 rule "Everyone rostered once per week")

---

## 💡 RECOMMENDATIONS

### For Admins:
1. Review `staff_list.available_roles` - ensure all staff have `['floor', 'cafe']` roles
2. Review `staff_list.has_keys` - update for staff who can open/close
3. Set `max_hours_per_week` carefully - affects how many shifts each person can work
4. Use natural language rules for business logic - avoid hardcoding more constraints

### For Developers:
1. **Priority Fix:** Implement flexible shift generation for constrained staff
2. Add admin UI to view/edit these hardcoded constraints
3. Consider making more constraints configurable (e.g., max hours per shift)
4. Add validation warnings when staff profiles are incomplete

---

## 🔗 Related Files

- `lib/services/roster-solver-service.ts` - Core constraint logic
- `app/api/roster/generate/route.ts` - API defaults
- `app/admin/roster/rules/page.tsx` - Natural language rules UI
- `app/admin/staff-config/page.tsx` - Staff configuration UI

---

**Need to add a new hardcoded rule?**
Consider first if it can be expressed as a natural language rule (Weight system). Only add hardcoded constraints for:
- Physical impossibilities (overlaps, time conflicts)
- System-level requirements (role permissions, keys)
- Performance optimizations (max retries, timeouts)
