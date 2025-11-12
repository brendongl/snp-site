/**
 * API Route: /api/roster/generate
 * Version: 2.0.0
 * Phase 2: Roster Generation with Constraint Solving
 *
 * POST: Generate optimal roster for a week using constraint solving
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterSolverService from '@/lib/services/roster-solver-service';
import RosterDbService from '@/lib/services/roster-db-service';
import type { ShiftRequirement, StaffMember } from '@/lib/services/roster-solver-service';
import pool from '@/lib/db/postgres';

/**
 * POST /api/roster/generate
 * Generate optimal roster for a week
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      week_start,
      shift_requirements,
      use_default_requirements = false,
      max_hours_per_week = 40,
      prefer_fairness = true,
      auto_save = false
    } = body;

    // Validate week start (must be a Monday)
    if (!week_start) {
      return NextResponse.json(
        { error: 'week_start is required (format: YYYY-MM-DD, must be Monday)' },
        { status: 400 }
      );
    }

    const weekDate = new Date(week_start + 'T00:00:00Z');
    if (weekDate.getDay() !== 1) {
      return NextResponse.json(
        { error: 'week_start must be a Monday' },
        { status: 400 }
      );
    }

    // Get shift requirements
    let requirements: ShiftRequirement[];
    if (use_default_requirements) {
      requirements = RosterSolverService.generateDefaultShiftRequirements();
    } else if (shift_requirements && Array.isArray(shift_requirements)) {
      requirements = shift_requirements;
    } else {
      return NextResponse.json(
        { error: 'Either shift_requirements array or use_default_requirements=true is required' },
        { status: 400 }
      );
    }

    // Fetch staff members with availability
    const client = await pool.connect();
    try {
      // Get all staff with rostering info
      const staffResult = await client.query(`
        SELECT
          id,
          staff_name,
          base_hourly_rate,
          has_keys,
          available_roles
        FROM staff_list
        WHERE base_hourly_rate IS NOT NULL
        ORDER BY staff_name
      `);

      if (staffResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'No staff members found with rostering info configured' },
          { status: 400 }
        );
      }

      // Fetch availability for each staff member
      const staffMembers: StaffMember[] = [];
      for (const staff of staffResult.rows) {
        const availability = await RosterDbService.getAvailabilityByStaffId(staff.id);
        staffMembers.push({
          id: staff.id,
          name: staff.staff_name,
          base_hourly_rate: staff.base_hourly_rate,
          has_keys: staff.has_keys || false,
          available_roles: staff.available_roles || [],
          availability
        });
      }

      // Fetch active scheduling rules
      const rules = await RosterDbService.getActiveRules();

      // Generate roster using constraint solver
      console.log(`🔧 Generating roster for week ${week_start}...`);
      console.log(`   Staff members: ${staffMembers.length}`);
      console.log(`   Shift requirements: ${requirements.length}`);
      console.log(`   Active rules: ${rules.length}`);

      const solution = await RosterSolverService.generateRoster({
        weekStart: week_start,
        shiftRequirements: requirements,
        staffMembers,
        rules,
        maxHoursPerWeek: max_hours_per_week,
        preferFairness: prefer_fairness
      });

      console.log(`   Solution score: ${solution.score}`);
      console.log(`   Valid: ${solution.is_valid}`);
      console.log(`   Violations: ${solution.violations.length}`);

      // Validate solution
      const validation = RosterSolverService.validateSolution(solution);

      // Auto-save if requested and solution is valid
      let saved = false;
      if (auto_save && solution.is_valid) {
        console.log('   💾 Auto-saving roster...');

        // Delete existing shifts for this week
        await RosterDbService.deleteShiftsByWeek(week_start);

        // Create new shifts
        for (const assignment of solution.assignments) {
          await RosterDbService.createShift({
            roster_week_start: week_start,
            day_of_week: assignment.shift_requirement.day_of_week as any,
            shift_type: assignment.shift_requirement.shift_type as any,
            staff_id: assignment.staff_id,
            scheduled_start: assignment.shift_requirement.scheduled_start,
            scheduled_end: assignment.shift_requirement.scheduled_end,
            role_required: assignment.shift_requirement.role_required
          });
        }

        saved = true;
        console.log('   ✅ Roster saved to database');
      }

      // Build response with staff names
      const assignmentsWithNames = solution.assignments.map(assignment => {
        const staff = staffMembers.find(s => s.id === assignment.staff_id);
        return {
          staff_id: assignment.staff_id,
          staff_name: staff?.name || 'Unknown',
          day_of_week: assignment.shift_requirement.day_of_week,
          shift_type: assignment.shift_requirement.shift_type,
          scheduled_start: assignment.shift_requirement.scheduled_start,
          scheduled_end: assignment.shift_requirement.scheduled_end,
          role_required: assignment.shift_requirement.role_required,
          score: assignment.score
        };
      });

      // Calculate staff hours
      const staffHours: Record<string, number> = {};
      for (const assignment of solution.assignments) {
        if (!staffHours[assignment.staff_id]) {
          staffHours[assignment.staff_id] = 0;
        }
        const [startHour, startMin] = assignment.shift_requirement.scheduled_start.split(':').map(Number);
        const [endHour, endMin] = assignment.shift_requirement.scheduled_end.split(':').map(Number);
        const hours = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
        staffHours[assignment.staff_id] += hours;
      }

      const staffSummary = staffMembers.map(staff => ({
        staff_id: staff.id,
        staff_name: staff.name,
        total_hours: staffHours[staff.id] || 0,
        shift_count: solution.assignments.filter(a => a.staff_id === staff.id).length
      }));

      return NextResponse.json({
        success: true,
        week_start,
        solution: {
          is_valid: solution.is_valid,
          score: solution.score,
          assignments: assignmentsWithNames,
          violations: solution.violations,
          validation
        },
        staff_summary: staffSummary,
        saved,
        metadata: {
          total_shifts: solution.assignments.length,
          total_staff: staffMembers.length,
          rules_applied: rules.length,
          generated_at: new Date().toISOString()
        }
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error generating roster:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate roster',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/roster/generate
 * Get information about roster generation capabilities
 */
export async function GET(request: NextRequest) {
  try {
    const defaultRequirements = RosterSolverService.generateDefaultShiftRequirements();

    // Get staff count
    const client = await pool.connect();
    let staffCount = 0;
    try {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM staff_list
        WHERE base_hourly_rate IS NOT NULL
      `);
      staffCount = parseInt(result.rows[0].count);
    } finally {
      client.release();
    }

    // Get active rules count
    const rules = await RosterDbService.getActiveRules();

    return NextResponse.json({
      capabilities: {
        constraint_solving: true,
        rule_parsing: true,
        fairness_optimization: true,
        availability_checking: true
      },
      configuration: {
        configured_staff: staffCount,
        active_rules: rules.length,
        default_shift_requirements: defaultRequirements.length
      },
      shift_types: ['opening', 'day', 'evening', 'closing'],
      constraint_types: [
        'max_hours',
        'min_hours',
        'preferred_hours',
        'max_consecutive_days',
        'day_off',
        'no_back_to_back',
        'requires_keys_for_opening',
        'fairness'
      ],
      example_request: {
        week_start: '2025-01-13',
        use_default_requirements: true,
        max_hours_per_week: 40,
        prefer_fairness: true,
        auto_save: false
      }
    });
  } catch (error: any) {
    console.error('Error getting roster generation info:', error);
    return NextResponse.json(
      {
        error: 'Failed to get roster generation info',
        details: error.message
      },
      { status: 500 }
    );
  }
}
