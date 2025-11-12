/**
 * Service: Roster Constraint Solver
 * Version: 2.0.0
 * Phase 2: Constraint Solving & Optimization
 *
 * Implements shift scheduling optimization using constraint satisfaction
 * and weighted scoring for soft constraints.
 */

import RosterDbService from './roster-db-service';
import type { RosterShift, StaffAvailability, RosterRule } from '@/types';

// ========================================
// Types
// ========================================

export interface StaffMember {
  id: string;
  name: string;
  base_hourly_rate: number;
  has_keys: boolean;
  available_roles: string[];
  availability: StaffAvailability[];
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
  shiftRequirements: ShiftRequirement[];
  staffMembers: StaffMember[];
  rules?: RosterRule[];
  maxHoursPerWeek?: number;
  preferFairness?: boolean;
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
    this.staffMembers = params.staffMembers;
    this.shiftRequirements = params.shiftRequirements;
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
      const candidates = this.findCandidatesForShift(shift, staffHours, violations);

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
    violations: ConstraintViolation[]
  ): ShiftAssignment[] {
    const candidates: ShiftAssignment[] = [];

    for (const staff of this.staffMembers) {
      const score = this.scoreStaffForShift(staff, shift, currentHours);

      // Check hard constraints
      const hardViolations = this.checkHardConstraints(staff, shift, currentHours);

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
   */
  private scoreStaffForShift(
    staff: StaffMember,
    shift: ShiftRequirement,
    currentHours: Record<string, number>
  ): number {
    let score = 100; // Base score

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
      const staffCurrentHours = currentHours[staff.id];
      const hoursDiff = avgHours - staffCurrentHours;
      score += hoursDiff * 5; // 5 points per hour below average
    }

    // Role match
    if (staff.available_roles.includes(shift.role_required)) {
      score += 30;
    } else {
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
    currentHours: Record<string, number>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // 1. Availability check
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

    // 2. Max hours per week
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

    // 3. Role requirement
    if (!staff.available_roles.includes(shift.role_required)) {
      violations.push({
        type: 'hard',
        constraint: 'ROLE_MISMATCH',
        staff_id: staff.id,
        shift,
        message: `Staff is not qualified for role: ${shift.role_required}`,
        severity: 100
      });
    }

    // 4. Keys requirement
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
  ): StaffAvailability | null {
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
   * Generate optimal roster for a week
   */
  static async generateRoster(params: GenerateRosterParams): Promise<RosterSolution> {
    const solver = new RosterSolver(params);
    return await solver.solve();
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
        scheduled_start: '09:00',
        scheduled_end: '14:00',
        role_required: 'cafe',
        requires_keys: true,
        min_staff: 1,
        max_staff: 1
      });

      // Day shift (2pm-6pm)
      requirements.push({
        day_of_week: day,
        shift_type: 'day',
        scheduled_start: '14:00',
        scheduled_end: '18:00',
        role_required: 'floor',
        min_staff: 1,
        max_staff: 2
      });

      // Evening shift (6pm-10pm)
      requirements.push({
        day_of_week: day,
        shift_type: 'evening',
        scheduled_start: '18:00',
        scheduled_end: '22:00',
        role_required: 'floor',
        min_staff: 1,
        max_staff: 2
      });

      // Closing shift (10pm-11pm, requires keys)
      if (day === 'Friday' || day === 'Saturday') {
        requirements.push({
          day_of_week: day,
          shift_type: 'closing',
          scheduled_start: '22:00',
          scheduled_end: '23:00',
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

    return {
      is_valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
