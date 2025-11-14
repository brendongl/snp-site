/**
 * Service: AI Roster Solver with Natural Language Rules
 * Version: 2.1.0
 * Phase 3: Constraint-Based Schedule Generation
 *
 * Uses parsed natural language rules to generate optimal staff rosters
 * through constraint satisfaction and weighted optimization.
 */

import pool from '@/lib/db/postgres';
import type { RosterShift, StaffAvailability } from '@/types';

// ========================================
// Types
// ========================================

export interface ParsedConstraint {
  type: string;
  [key: string]: any;
}

export interface RosterRule {
  id: string;
  rule_text: string;
  parsed_constraint: ParsedConstraint;
  weight: number;
  is_active: boolean;
}

export interface AvailabilityPattern {
  day_of_week: string;
  hour_start: number;
  hour_end: number;
  availability_status: 'available' | 'preferred_not' | 'unavailable';
}

export interface StaffMember {
  id: string;
  name: string;
  nickname?: string;
  base_hourly_rate?: number;
  has_keys?: boolean;
  available_roles?: string[];
  availability: AvailabilityPattern[];
  vikunja_user_id?: number;
}

export interface ShiftRequirement {
  day_of_week: string;
  shift_type: 'opening' | 'day' | 'evening' | 'closing';
  scheduled_start: string;
  scheduled_end: string;
  role_required: string;
  min_staff?: number;
  max_staff?: number;
  requires_keys?: boolean;
}

export interface ShiftAssignment {
  staff_id: string;
  shift_requirement: ShiftRequirement;
  score: number;
}

export interface ConstraintViolation {
  type: 'hard' | 'soft';
  constraint: string;
  staff_id?: string;
  shift?: ShiftRequirement;
  message: string;
  severity: number;
}

export interface RosterSolution {
  assignments: ShiftAssignment[];
  score: number;
  violations: ConstraintViolation[];
  is_valid: boolean;
}

export interface GenerateRosterParams {
  weekStart: string;
  shiftRequirements?: ShiftRequirement[]; // Optional, can be generated from rules
  staffMembers?: StaffMember[]; // Optional, fetched from database
  rules?: RosterRule[]; // Optional, fetched from database
  maxHoursPerWeek?: number;
  preferFairness?: boolean;
}

export interface WeeklyRoster {
  week_start: Date;
  week_end: Date;
  shifts: RosterShift[];
  staff_hours: Map<string, number>;
  constraint_violations: ConstraintViolation[];
  optimization_score: number;
}

// ========================================
// Constraint Solver
// ========================================

export class RosterSolver {
  private staffMembers: StaffMember[];
  private shiftRequirements: ShiftRequirement[];
  private rules: RosterRule[];
  private weekStart: string;
  private maxHoursPerWeek: number;
  private preferFairness: boolean;

  constructor(params: GenerateRosterParams) {
    this.weekStart = params.weekStart;
    this.staffMembers = params.staffMembers || [];
    this.shiftRequirements = params.shiftRequirements || [];
    this.rules = params.rules || [];
    this.maxHoursPerWeek = params.maxHoursPerWeek || 40;
    this.preferFairness = params.preferFairness ?? true;
  }

  /**
   * Generate optimal roster for the week
   */
  async solve(): Promise<RosterSolution> {
    const violations: ConstraintViolation[] = [];
    const assignments: ShiftAssignment[] = [];

    // Track staff hours
    const staffHours: Record<string, number> = {};
    this.staffMembers.forEach(staff => {
      staffHours[staff.id] = 0;
    });

    // For each shift requirement, find the best staff member
    for (const shift of this.shiftRequirements) {
      const candidates = this.findCandidatesForShift(shift, staffHours, assignments, violations);

      if (candidates.length === 0) {
        violations.push({
          type: 'hard',
          constraint: 'NO_AVAILABLE_STAFF',
          shift,
          message: `No staff available for ${shift.day_of_week} ${shift.shift_type} shift`,
          severity: 100
        });
        continue;
      }

      // Sort by score (higher is better)
      candidates.sort((a, b) => b.score - a.score);

      // Assign best candidate
      const bestCandidate = candidates[0];
      assignments.push(bestCandidate);

      // Update hours
      const shiftHours = this.calculateShiftHours(shift.scheduled_start, shift.scheduled_end);
      staffHours[bestCandidate.staff_id] += shiftHours;
    }

    // Check for fairness violations
    if (this.preferFairness) {
      const fairnessViolations = this.checkFairness(staffHours);
      violations.push(...fairnessViolations);
    }

    // ✅ NEW: Validate global constraints (Weekly Frequency, Min Hours, etc.)
    const globalViolations = this.validateGlobalConstraints(assignments, staffHours);
    violations.push(...globalViolations);

    // Calculate total score
    const totalScore = this.calculateTotalScore(assignments, violations);

    // Check if solution is valid (no hard constraint violations)
    const isValid = violations.filter(v => v.type === 'hard').length === 0;

    return {
      assignments,
      score: totalScore,
      violations,
      is_valid: isValid
    };
  }

  /**
   * Find candidate staff members for a shift
   */
  private findCandidatesForShift(
    shift: ShiftRequirement,
    currentHours: Record<string, number>,
    currentAssignments: ShiftAssignment[],
    violations: ConstraintViolation[]
  ): ShiftAssignment[] {
    const candidates: ShiftAssignment[] = [];

    for (const staff of this.staffMembers) {
      const score = this.scoreStaffForShift(staff, shift, currentHours);

      // Check hard constraints
      const hardViolations = this.checkHardConstraints(staff, shift, currentHours, currentAssignments);

      if (hardViolations.length > 0) {
        // Skip this staff member
        continue;
      }

      // Check soft constraints (don't skip, just reduce score)
      const softViolations = this.checkSoftConstraints(staff, shift, currentHours);
      let adjustedScore = score;

      for (const violation of softViolations) {
        adjustedScore -= violation.severity;
      }

      candidates.push({
        staff_id: staff.id,
        shift_requirement: shift,
        score: adjustedScore
      });
    }

    return candidates;
  }

  /**
   * Score a staff member for a specific shift
   * ✅ UPDATED v1.10.4: Prioritize satisfying high-priority constraints (weight >= 90)
   */
  private scoreStaffForShift(
    staff: StaffMember,
    shift: ShiftRequirement,
    currentHours: Record<string, number>
  ): number {
    let score = 100; // Base score
    const staffCurrentHours = currentHours[staff.id] || 0;

    // ✅ CRITICAL BOOST: Weekly Frequency (Weight 100)
    // Heavily prioritize staff with 0 hours to ensure everyone gets at least 1 shift
    const weeklyFrequencyRule = this.rules.find(r =>
      r.is_active && (r.parsed_constraint as any).type === 'weekly_frequency' && r.weight >= 90
    );
    if (weeklyFrequencyRule && staffCurrentHours === 0) {
      score += 200; // Massive boost for unrostered staff
      console.log(`[Roster Solver] 🎯 Boosting ${staff.nickname || staff.name} (+200) - Weekly Frequency priority (0 hours)`);
    }

    // ✅ HIGH PRIORITY: Min Hours (Weight 90)
    // Boost staff who are below their minimum hour requirements
    const minHoursRule = this.rules.find(r => {
      if (!r.is_active || (r.parsed_constraint as any).type !== 'min_hours') return false;
      const constraint = r.parsed_constraint as any;
      return (constraint.staff_name === staff.nickname || constraint.staff_name === staff.name) && r.weight >= 90;
    });
    if (minHoursRule) {
      const minHours = (minHoursRule.parsed_constraint as any).min_hours || 0;
      if (staffCurrentHours < minHours) {
        const hoursNeeded = minHours - staffCurrentHours;
        score += hoursNeeded * 10; // 10 points per hour needed
        console.log(`[Roster Solver] 🎯 Boosting ${staff.nickname || staff.name} (+${hoursNeeded * 10}) - Min Hours priority (${staffCurrentHours}/${minHours}h)`);
      }
    }

    // ✅ HIGH PRIORITY: Priority Rules (Weight 90)
    // Heavily penalize low-priority staff (e.g., Brendon as last resort)
    const priorityRule = this.rules.find(r => {
      if (!r.is_active || (r.parsed_constraint as any).type !== 'priority') return false;
      const constraint = r.parsed_constraint as any;
      return (constraint.staff_name === staff.nickname || constraint.staff_name === staff.name) && r.weight >= 90;
    });
    if (priorityRule) {
      const priority = (priorityRule.parsed_constraint as any).priority;
      if (priority === 'low') {
        score -= 150; // Heavy penalty for low-priority staff
        console.log(`[Roster Solver] ⬇️ Penalizing ${staff.nickname || staff.name} (-150) - Low priority (last resort)`);
      }
    }

    // Check availability
    const availability = this.getAvailabilityForShift(staff, shift);
    if (availability) {
      if (availability.availability_status === 'available') {
        score += 50;
      } else if (availability.availability_status === 'preferred_not') {
        score -= 30;
      }
    }

    // Prefer staff with fewer hours (fairness)
    if (this.preferFairness) {
      const avgHours = Object.values(currentHours).reduce((a, b) => a + b, 0) / this.staffMembers.length;
      const hoursDiff = avgHours - staffCurrentHours;
      score += hoursDiff * 5; // 5 points per hour below average
    }

    // Role match
    if (staff.available_roles?.includes(shift.role_required)) {
      score += 30;
    } else if (staff.available_roles) {
      score -= 50; // Penalize role mismatch
    }

    // Keys requirement
    if (shift.requires_keys && !staff.has_keys) {
      score -= 100; // Heavy penalty for missing keys
    } else if (shift.requires_keys && staff.has_keys) {
      score += 20;
    }

    return score;
  }

  /**
   * Check hard constraints (must be satisfied)
   */
  private checkHardConstraints(
    staff: StaffMember,
    shift: ShiftRequirement,
    currentHours: Record<string, number>,
    currentAssignments: ShiftAssignment[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // 1. No overlapping shifts (CRITICAL - cannot schedule same person twice at same time)
    const overlappingShift = this.findOverlappingShift(staff.id, shift, currentAssignments);
    if (overlappingShift) {
      violations.push({
        type: 'hard',
        constraint: 'OVERLAPPING_SHIFTS',
        staff_id: staff.id,
        shift,
        message: `Staff already assigned to overlapping shift on ${shift.day_of_week} (${overlappingShift.scheduled_start}-${overlappingShift.scheduled_end})`,
        severity: 1000 // Highest severity - this is impossible to violate
      });
    }

    // 2. Availability check
    const availability = this.getAvailabilityForShift(staff, shift);
    if (availability && availability.availability_status === 'unavailable') {
      violations.push({
        type: 'hard',
        constraint: 'UNAVAILABLE',
        staff_id: staff.id,
        shift,
        message: `Staff is unavailable on ${shift.day_of_week} during shift hours`,
        severity: 100
      });
    }

    // 3. Max hours per week
    const shiftHours = this.calculateShiftHours(shift.scheduled_start, shift.scheduled_end);
    if (currentHours[staff.id] + shiftHours > this.maxHoursPerWeek) {
      violations.push({
        type: 'hard',
        constraint: 'MAX_HOURS_EXCEEDED',
        staff_id: staff.id,
        shift,
        message: `Assigning this shift would exceed max weekly hours (${this.maxHoursPerWeek})`,
        severity: 100
      });
    }

    // 4. Role requirement
    if (staff.available_roles && !staff.available_roles.includes(shift.role_required)) {
      violations.push({
        type: 'hard',
        constraint: 'ROLE_MISMATCH',
        staff_id: staff.id,
        shift,
        message: `Staff is not qualified for role: ${shift.role_required}`,
        severity: 100
      });
    }

    // 5. Keys requirement
    if (shift.requires_keys && !staff.has_keys) {
      violations.push({
        type: 'hard',
        constraint: 'MISSING_KEYS',
        staff_id: staff.id,
        shift,
        message: `Staff does not have keys required for ${shift.shift_type} shift`,
        severity: 100
      });
    }

    return violations;
  }

  /**
   * Check soft constraints (preferences, can be violated with penalty)
   */
  private checkSoftConstraints(
    staff: StaffMember,
    shift: ShiftRequirement,
    currentHours: Record<string, number>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // 1. Preferred not available
    const availability = this.getAvailabilityForShift(staff, shift);
    if (availability && availability.availability_status === 'preferred_not') {
      violations.push({
        type: 'soft',
        constraint: 'PREFERRED_NOT',
        staff_id: staff.id,
        shift,
        message: `Staff prefers not to work on ${shift.day_of_week}`,
        severity: 30
      });
    }

    // 2. Apply custom rules
    for (const rule of this.rules) {
      if (!rule.is_active) continue;

      const violation = this.evaluateRule(rule, staff, shift, currentHours);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Evaluate a custom rule
   */
  private evaluateRule(
    rule: RosterRule,
    staff: StaffMember,
    shift: ShiftRequirement,
    currentHours: Record<string, number>
  ): ConstraintViolation | null {
    // Cast to any to handle flexible constraint structure
    const constraint = rule.parsed_constraint as any;

    // Example rule format:
    // { type: 'max_consecutive_days', staff_id: 'xxx', max_days: 5 }
    // { type: 'preferred_hours', staff_id: 'xxx', min_hours: 20, max_hours: 30 }
    // { type: 'no_back_to_back', shift_types: ['closing', 'opening'] }

    // For Phase 2, we'll implement basic rule evaluation
    // More complex rules will be added as needed

    if (constraint.type === 'max_consecutive_days') {
      // TODO: Implement consecutive days tracking
    } else if (constraint.type === 'preferred_hours') {
      if (constraint.staff_id === staff.id) {
        const min = constraint.min_hours || 0;
        const max = constraint.max_hours || 40;
        const shiftHours = this.calculateShiftHours(shift.scheduled_start, shift.scheduled_end);
        const totalHours = currentHours[staff.id] + shiftHours;

        if (totalHours > max) {
          return {
            type: 'soft',
            constraint: rule.rule_text,
            staff_id: staff.id,
            shift,
            message: `Exceeds preferred maximum hours (${max})`,
            severity: rule.weight
          };
        }
      }
    }

    return null;
  }

  /**
   * Get availability for a specific shift
   */
  private getAvailabilityForShift(
    staff: StaffMember,
    shift: ShiftRequirement
  ): AvailabilityPattern | null {
    const shiftStartHour = parseInt(shift.scheduled_start.split(':')[0]);
    const shiftEndHour = parseInt(shift.scheduled_end.split(':')[0]);

    // Find availability slot that covers the shift
    const matchingSlot = staff.availability.find(slot => {
      return (
        slot.day_of_week === shift.day_of_week &&
        slot.hour_start <= shiftStartHour &&
        slot.hour_end >= shiftEndHour
      );
    });

    return matchingSlot || null;
  }

  /**
   * Check if staff member has an overlapping shift assignment
   * CRITICAL: Cannot schedule same person for two shifts at the same time
   */
  private findOverlappingShift(
    staffId: string,
    newShift: ShiftRequirement,
    currentAssignments: ShiftAssignment[]
  ): ShiftRequirement | null {
    // Get all assignments for this staff member
    const staffAssignments = currentAssignments.filter(a => a.staff_id === staffId);

    // Convert time strings to minutes for accurate comparison
    const newStart = this.timeToMinutes(newShift.scheduled_start);
    const newEnd = this.timeToMinutes(newShift.scheduled_end);

    // Check each existing assignment for overlap
    for (const assignment of staffAssignments) {
      const existingShift = assignment.shift_requirement;

      // Only check shifts on the same day
      if (existingShift.day_of_week !== newShift.day_of_week) {
        continue;
      }

      const existingStart = this.timeToMinutes(existingShift.scheduled_start);
      const existingEnd = this.timeToMinutes(existingShift.scheduled_end);

      // Check for overlap: shifts overlap if one starts before the other ends
      // Overlap formula: (start1 < end2) AND (start2 < end1)
      if (newStart < existingEnd && existingStart < newEnd) {
        return existingShift; // Found overlapping shift
      }
    }

    return null; // No overlap found
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   * CRITICAL FIX: Treat 00:00 as 24:00 (1440 minutes) for same-day overlap checking
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // If time is 00:00, treat as end of day (24:00 = 1440 minutes)
    if (totalMinutes === 0) {
      return 1440;
    }

    return totalMinutes;
  }

  /**
   * Snap time to nearest :00 or :30 mark
   * Examples: 11:59 → 12:00, 18:15 → 18:00, 18:45 → 19:00
   */
  private snapTimeToInterval(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);

    // Round minutes to nearest :00 or :30
    let snappedMinutes: number;
    if (minutes < 15) {
      snappedMinutes = 0;
    } else if (minutes < 45) {
      snappedMinutes = 30;
    } else {
      snappedMinutes = 0;
      // If rounding up from :45-:59, increment hour
      return `${String(hours + 1).padStart(2, '0')}:00`;
    }

    return `${String(hours).padStart(2, '0')}:${String(snappedMinutes).padStart(2, '0')}`;
  }

  /**
   * Calculate shift hours
   */
  private calculateShiftHours(start: string, end: string): number {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return (endMinutes - startMinutes) / 60;
  }

  /**
   * Check fairness in hour distribution
   */
  private checkFairness(staffHours: Record<string, number>): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    const hours = Object.values(staffHours);
    const avgHours = hours.reduce((a, b) => a + b, 0) / hours.length;
    const maxHours = Math.max(...hours);
    const minHours = Math.min(...hours);

    // If difference is more than 10 hours, flag as unfair
    if (maxHours - minHours > 10) {
      violations.push({
        type: 'soft',
        constraint: 'FAIRNESS_VIOLATION',
        message: `Uneven hour distribution: ${minHours.toFixed(1)}h to ${maxHours.toFixed(1)}h (avg: ${avgHours.toFixed(1)}h)`,
        severity: 20
      });
    }

    return violations;
  }

  /**
   * ✅ NEW: Validate global constraints after roster generation
   * Checks rules that apply to the entire roster, not individual shifts:
   * - Weekly Frequency: All staff rostered at least once
   * - Min Hours: Staff meet minimum hour requirements
   * - Priority: Low-priority staff only used as last resort
   *
   * Rules with weight >= 100 are treated as HARD constraints (cannot be violated)
   * Rules with weight 90-99 are treated as HIGH-PRIORITY soft constraints
   */
  private validateGlobalConstraints(
    assignments: ShiftAssignment[],
    staffHours: Record<string, number>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Process each rule
    for (const rule of this.rules) {
      if (!rule.is_active) continue;

      const constraint = rule.parsed_constraint as any;
      const violationType = rule.weight >= 100 ? 'hard' : 'soft';

      // 1. WEEKLY FREQUENCY: "All staff should be rostered on at least once per week"
      if (constraint.type === 'weekly_frequency') {
        const staffWithZeroHours = this.staffMembers.filter(staff => {
          const hours = staffHours[staff.id] || 0;
          return hours === 0;
        });

        if (staffWithZeroHours.length > 0) {
          const staffNames = staffWithZeroHours.map(s => s.nickname || s.name).join(', ');
          violations.push({
            type: violationType,
            constraint: rule.rule_text,
            message: `${staffWithZeroHours.length} staff member(s) not rostered this week: ${staffNames}`,
            severity: rule.weight
          });

          console.warn(`[Roster Solver] ⚠️ Weekly Frequency violation (Weight ${rule.weight}): ${staffNames} have 0 hours`);
        }
      }

      // 2. MIN HOURS: "Staff X should have at least Y hours"
      else if (constraint.type === 'min_hours') {
        const staffName = constraint.staff_name;
        const minHours = constraint.min_hours || 0;

        // Find staff member by name (nickname or full name)
        const staffMember = this.staffMembers.find(
          s => s.nickname === staffName || s.name === staffName
        );

        if (staffMember) {
          const actualHours = staffHours[staffMember.id] || 0;

          if (actualHours < minHours) {
            violations.push({
              type: violationType,
              constraint: rule.rule_text,
              staff_id: staffMember.id,
              message: `${staffName} has ${actualHours.toFixed(1)}h (requires ${minHours}h minimum)`,
              severity: rule.weight
            });

            console.warn(`[Roster Solver] ⚠️ Min Hours violation (Weight ${rule.weight}): ${staffName} has ${actualHours}h < ${minHours}h required`);
          }
        }
      }

      // 3. PRIORITY: "Staff X should only be scheduled as a last resort"
      else if (constraint.type === 'priority') {
        const staffName = constraint.staff_name;
        const priority = constraint.priority; // 'low' or 'high'

        if (priority === 'low') {
          // Find staff member
          const staffMember = this.staffMembers.find(
            s => s.nickname === staffName || s.name === staffName
          );

          if (staffMember) {
            const actualHours = staffHours[staffMember.id] || 0;

            // If low-priority staff was rostered, check if others have capacity
            if (actualHours > 0) {
              const staffWithLowHours = this.staffMembers.filter(
                s => s.id !== staffMember.id && (staffHours[s.id] || 0) < this.maxHoursPerWeek * 0.8
              );

              if (staffWithLowHours.length > 0) {
                violations.push({
                  type: violationType,
                  constraint: rule.rule_text,
                  staff_id: staffMember.id,
                  message: `${staffName} rostered for ${actualHours.toFixed(1)}h despite being low-priority (${staffWithLowHours.length} staff have capacity)`,
                  severity: rule.weight
                });

                console.warn(`[Roster Solver] ⚠️ Priority violation (Weight ${rule.weight}): ${staffName} used despite low priority`);
              }
            }
          }
        }
      }

      // 4. MAX HOURS: "Staff X should have at most Y hours"
      else if (constraint.type === 'max_hours') {
        const staffName = constraint.staff_name;
        const maxHours = constraint.max_hours || this.maxHoursPerWeek;

        const staffMember = this.staffMembers.find(
          s => s.nickname === staffName || s.name === staffName
        );

        if (staffMember) {
          const actualHours = staffHours[staffMember.id] || 0;

          if (actualHours > maxHours) {
            violations.push({
              type: violationType,
              constraint: rule.rule_text,
              staff_id: staffMember.id,
              message: `${staffName} has ${actualHours.toFixed(1)}h (exceeds ${maxHours}h maximum)`,
              severity: rule.weight
            });

            console.warn(`[Roster Solver] ⚠️ Max Hours violation (Weight ${rule.weight}): ${staffName} has ${actualHours}h > ${maxHours}h allowed`);
          }
        }
      }
    }

    return violations;
  }

  /**
   * Calculate total score for solution
   */
  private calculateTotalScore(
    assignments: ShiftAssignment[],
    violations: ConstraintViolation[]
  ): number {
    let score = 0;

    // Add up assignment scores
    for (const assignment of assignments) {
      score += assignment.score;
    }

    // Subtract violation penalties
    for (const violation of violations) {
      if (violation.type === 'hard') {
        score -= 1000; // Heavy penalty for hard violations
      } else {
        score -= violation.severity;
      }
    }

    return score;
  }
}

// ========================================
// Service Methods
// ========================================

export default class RosterSolverService {
  /**
   * Generate optimal roster for a week using natural language rules
   * With retry logic to prevent overlapping shifts
   */
  static async generateRoster(params: GenerateRosterParams): Promise<RosterSolution> {
    console.log('[Roster Solver] Starting roster generation with natural language rules...');

    // Fetch rules from database if not provided
    const rules = params.rules || await this.fetchActiveRules();
    console.log(`  Loaded ${rules.length} active rules`);

    // Fetch staff members if not provided
    const staffMembers = params.staffMembers || await this.fetchStaffMembers();
    console.log(`  Loaded ${staffMembers.length} staff members`);

    // Generate shift requirements from rules if not provided
    const shiftRequirements = params.shiftRequirements ||
      await this.generateShiftRequirementsFromRules(rules, params.weekStart);
    console.log(`  Generated ${shiftRequirements.length} shift requirements`);

    // Create solver with all data
    const solverParams = {
      ...params,
      shiftRequirements,
      staffMembers,
      rules
    };

    // Retry up to 3 times if overlapping shifts are detected
    const maxRetries = 3;
    let attempt = 1;
    let solution: RosterSolution;

    while (attempt <= maxRetries) {
      console.log(`  Attempt ${attempt}/${maxRetries}: Generating roster...`);

      const solver = new RosterSolver(solverParams);
      solution = await solver.solve();

      // Validate for overlapping shifts
      const overlapCheck = this.validateNoOverlaps(solution);

      if (!overlapCheck.has_overlaps) {
        console.log(`  ✅ Generation successful (no overlaps)`);
        return solution;
      }

      // Log overlap issue
      console.warn(`  ⚠️ Attempt ${attempt} failed: ${overlapCheck.overlapping_staff.length} staff members have overlapping shifts`);
      for (const overlap of overlapCheck.overlapping_staff) {
        console.warn(`     - Staff on ${overlap.day}: ${overlap.shifts.map(s => `${s.start}-${s.end}`).join(', ')}`);
      }

      // If last attempt, add overlaps as hard constraint violations
      if (attempt === maxRetries) {
        console.error(`  ❌ All ${maxRetries} attempts failed. Returning solution with overlap violations.`);

        // Add overlap violations to solution
        for (const overlap of overlapCheck.overlapping_staff) {
          solution!.violations.push({
            type: 'hard',
            constraint: 'OVERLAPPING_SHIFTS',
            staff_id: overlap.staff_id,
            message: `Staff has overlapping shifts on ${overlap.day}: ${overlap.shifts.map(s => `${s.start}-${s.end}`).join(', ')}`,
            severity: 1000
          });
        }

        solution!.is_valid = false;
        return solution!;
      }

      attempt++;
    }

    // TypeScript safety (should never reach here)
    throw new Error('Roster generation failed unexpectedly');
  }

  /**
   * Fetch active roster rules from database
   */
  static async fetchActiveRules(): Promise<RosterRule[]> {
    const result = await pool.query(`
      SELECT id, rule_text, parsed_constraint, weight, is_active
      FROM roster_rules
      WHERE is_active = true
      ORDER BY weight DESC, created_at ASC
    `);

    return result.rows.map(row => ({
      id: row.id,
      rule_text: row.rule_text,
      parsed_constraint: row.parsed_constraint,
      weight: row.weight,
      is_active: row.is_active
    }));
  }

  /**
   * Fetch staff members from database with their availability patterns
   */
  static async fetchStaffMembers(): Promise<StaffMember[]> {
    // Fetch staff members
    const staffResult = await pool.query(`
      SELECT
        id,
        staff_name as name,
        nickname,
        vikunja_user_id,
        has_keys,
        available_roles
      FROM staff_list
      ORDER BY staff_name
    `);

    // Fetch all availability patterns
    const availabilityResult = await pool.query(`
      SELECT
        staff_id,
        day_of_week,
        hour_start,
        hour_end,
        availability_status
      FROM staff_availability
    `);

    // Group availability by staff_id
    const availabilityByStaff = new Map<string, AvailabilityPattern[]>();
    for (const row of availabilityResult.rows) {
      if (!availabilityByStaff.has(row.staff_id)) {
        availabilityByStaff.set(row.staff_id, []);
      }
      availabilityByStaff.get(row.staff_id)!.push({
        day_of_week: row.day_of_week,
        hour_start: row.hour_start,
        hour_end: row.hour_end,
        availability_status: row.availability_status
      });
    }

    // Combine staff with their availability
    return staffResult.rows.map(row => ({
      id: row.id,
      name: row.nickname || row.name,
      nickname: row.nickname,
      vikunja_user_id: row.vikunja_user_id,
      availability: availabilityByStaff.get(row.id) || this.getDefaultAvailability(),
      has_keys: row.has_keys || false,
      available_roles: row.available_roles || []
    }));
  }

  /**
   * Generate shift requirements from natural language rules
   */
  static async generateShiftRequirementsFromRules(
    rules: RosterRule[],
    weekStart: string
  ): Promise<ShiftRequirement[]> {
    const requirements: ShiftRequirement[] = [];

    // Parse opening_time rules to create opening shifts
    const openingRules = rules.filter(r => r.parsed_constraint.type === 'opening_time');
    for (const rule of openingRules) {
      const constraint = rule.parsed_constraint;
      const days = constraint.days || [];
      const time = constraint.time || '09:00';

      for (const day of days) {
        const endTime = this.addHours(time, 5); // Default 5 hour shift
        requirements.push({
          day_of_week: day,
          shift_type: 'opening',
          scheduled_start: this.snapTime(time),
          scheduled_end: this.snapTime(endTime),
          role_required: 'cafe',
          requires_keys: true,
          min_staff: 1
        });
      }
    }

    // Parse min_coverage rules to create coverage requirements
    const coverageRules = rules.filter(r => r.parsed_constraint.type === 'min_coverage');
    for (const rule of coverageRules) {
      const constraint = rule.parsed_constraint;
      const minStaff = constraint.min_staff || 2;
      const days = constraint.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const timeRange = constraint.time_range;

      // Handle different time range types
      if (timeRange === 'all') {
        // Full day coverage for all days
        for (const day of days) {
          // Day shift
          requirements.push({
            day_of_week: day,
            shift_type: 'day',
            scheduled_start: this.snapTime('12:00'),
            scheduled_end: this.snapTime('18:00'),
            role_required: 'floor',
            min_staff: minStaff
          });

          // Evening shift
          requirements.push({
            day_of_week: day,
            shift_type: 'evening',
            scheduled_start: this.snapTime('18:00'),
            scheduled_end: this.snapTime('23:00'),
            role_required: 'floor',
            min_staff: minStaff
          });
        }
      } else if (typeof timeRange === 'object' && timeRange.start && timeRange.end) {
        // Specific time range
        for (const day of days) {
          requirements.push({
            day_of_week: day,
            shift_type: 'day',
            scheduled_start: this.snapTime(timeRange.start),
            scheduled_end: this.snapTime(timeRange.end),
            role_required: 'floor',
            min_staff: minStaff
          });
        }
      }
    }

    console.log(`  Generated ${requirements.length} shift requirements from ${rules.length} rules`);
    return requirements;
  }

  /**
   * Default availability (all days 9am-11pm)
   */
  private static getDefaultAvailability(): AvailabilityPattern[] {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.map(day => ({
      day_of_week: day,
      hour_start: 9,
      hour_end: 23,
      availability_status: 'available' as const
    }));
  }

  /**
   * Add hours to a time string
   */
  private static addHours(time: string, hours: number): string {
    const [hour, minute] = time.split(':').map(Number);
    let newHour = hour + hours;
    if (newHour >= 24) newHour = 23;
    return `${newHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  /**
   * Snap time to nearest :00 or :30 mark (static version for shift generation)
   * Examples: 11:59 → 12:00, 18:15 → 18:00, 18:45 → 19:00, 23:59 → 00:00 (next day)
   */
  private static snapTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);

    // Round minutes to nearest :00 or :30
    if (minutes < 15) {
      return `${String(hours).padStart(2, '0')}:00`;
    } else if (minutes < 45) {
      return `${String(hours).padStart(2, '0')}:30`;
    } else {
      // If rounding up from :45-:59, increment hour
      const nextHour = (hours + 1) % 24;
      return `${String(nextHour).padStart(2, '0')}:00`;
    }
  }

  /**
   * Generate shift requirements based on store hours
   */
  static generateDefaultShiftRequirements(): ShiftRequirement[] {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const requirements: ShiftRequirement[] = [];

    for (const day of days) {
      // Opening shift (9am-2pm, requires keys)
      requirements.push({
        day_of_week: day,
        shift_type: 'opening',
        scheduled_start: this.snapTime('09:00'),
        scheduled_end: this.snapTime('14:00'),
        role_required: 'cafe',
        requires_keys: true,
        min_staff: 1,
        max_staff: 1
      });

      // Day shift (2pm-6pm)
      requirements.push({
        day_of_week: day,
        shift_type: 'day',
        scheduled_start: this.snapTime('14:00'),
        scheduled_end: this.snapTime('18:00'),
        role_required: 'floor',
        min_staff: 1,
        max_staff: 2
      });

      // Evening shift (6pm-10pm)
      requirements.push({
        day_of_week: day,
        shift_type: 'evening',
        scheduled_start: this.snapTime('18:00'),
        scheduled_end: this.snapTime('22:00'),
        role_required: 'floor',
        min_staff: 1,
        max_staff: 2
      });

      // Closing shift (10pm-11pm, requires keys)
      if (day === 'Friday' || day === 'Saturday') {
        requirements.push({
          day_of_week: day,
          shift_type: 'closing',
          scheduled_start: this.snapTime('22:00'),
          scheduled_end: this.snapTime('23:00'),
          role_required: 'cafe',
          requires_keys: true,
          min_staff: 1,
          max_staff: 1
        });
      }
    }

    return requirements;
  }

  /**
   * Validate that no staff member has overlapping shifts
   * CRITICAL: Catch any overlaps that slipped through the constraint checking
   */
  static validateNoOverlaps(solution: RosterSolution): {
    has_overlaps: boolean;
    overlapping_staff: Array<{
      staff_id: string;
      day: string;
      shifts: Array<{ start: string; end: string }>;
    }>;
  } {
    const overlappingStaff: Array<{
      staff_id: string;
      day: string;
      shifts: Array<{ start: string; end: string }>;
    }> = [];

    // Group assignments by staff and day
    const byStaffAndDay = new Map<string, ShiftAssignment[]>();

    for (const assignment of solution.assignments) {
      const key = `${assignment.staff_id}:${assignment.shift_requirement.day_of_week}`;
      if (!byStaffAndDay.has(key)) {
        byStaffAndDay.set(key, []);
      }
      byStaffAndDay.get(key)!.push(assignment);
    }

    // Check each staff member's shifts for each day
    for (const [key, assignments] of byStaffAndDay.entries()) {
      const [staffId, day] = key.split(':');

      // If more than one shift on this day, check for overlaps
      if (assignments.length > 1) {
        // Convert to time intervals for checking
        const shifts = assignments.map(a => ({
          start: a.shift_requirement.scheduled_start,
          end: a.shift_requirement.scheduled_end,
        }));

        // Check if any pair overlaps
        for (let i = 0; i < shifts.length; i++) {
          for (let j = i + 1; j < shifts.length; j++) {
            const shift1 = shifts[i];
            const shift2 = shifts[j];

            const start1 = this.timeToMinutes(shift1.start);
            const end1 = this.timeToMinutes(shift1.end);
            const start2 = this.timeToMinutes(shift2.start);
            const end2 = this.timeToMinutes(shift2.end);

            // Check overlap: (start1 < end2) AND (start2 < end1)
            if (start1 < end2 && start2 < end1) {
              overlappingStaff.push({
                staff_id: staffId,
                day,
                shifts: [shift1, shift2],
              });
              break; // Found overlap for this staff/day combo
            }
          }
        }
      }
    }

    return {
      has_overlaps: overlappingStaff.length > 0,
      overlapping_staff: overlappingStaff,
    };
  }

  /**
   * Convert time string to minutes (static version for validation)
   * CRITICAL FIX: Treat 00:00 as 24:00 (1440 minutes) for same-day overlap checking
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // If time is 00:00, treat as end of day (24:00 = 1440 minutes)
    // This ensures shifts like 17:00-00:00 are properly detected as overlapping with 18:00-23:00
    if (totalMinutes === 0) {
      return 1440;
    }

    return totalMinutes;
  }

  /**
   * Validate a roster solution
   */
  static validateSolution(solution: RosterSolution): {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for hard constraint violations
    const hardViolations = solution.violations.filter(v => v.type === 'hard');
    for (const violation of hardViolations) {
      errors.push(violation.message);
    }

    // Check for soft constraint violations
    const softViolations = solution.violations.filter(v => v.type === 'soft');
    for (const violation of softViolations) {
      warnings.push(violation.message);
    }

    // CRITICAL: Check for overlapping shifts (double-booking)
    const overlapCheck = this.validateNoOverlaps(solution);
    if (overlapCheck.has_overlaps) {
      for (const overlap of overlapCheck.overlapping_staff) {
        errors.push(
          `OVERLAPPING_SHIFTS: Staff member has multiple shifts on ${overlap.day} (${overlap.shifts.map(s => `${s.start}-${s.end}`).join(', ')})`
        );
      }
    }

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
