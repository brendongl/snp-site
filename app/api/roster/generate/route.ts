/**
 * API Route: /api/roster/generate
 * Version: 2.1.0
 * Phase 3: AI Roster Generation with Natural Language Rules
 *
 * POST: Generate optimal roster for a week using parsed natural language rules
 * GET: Preview shift requirements that would be generated from rules
 */

import { NextRequest, NextResponse } from 'next/server';
import RosterSolverService from '@/lib/services/roster-solver-service';
import pool from '@/lib/db/postgres';

/**
 * POST /api/roster/generate
 * Generate optimal roster using natural language rules
 *
 * Request body:
 * {
 *   week_start: string;        // ISO date (YYYY-MM-DD, must be Monday)
 *   max_hours_per_week?: number; // Default: 40
 *   prefer_fairness?: boolean;   // Default: true
 *   model?: string;              // OpenRouter model ID (default: anthropic/claude-haiku-4.5)
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      week_start,
      max_hours_per_week = 40,
      prefer_fairness = true,
      model = 'anthropic/claude-haiku-4.5'
    } = body;

    // Validate week start
    if (!week_start) {
      return NextResponse.json(
        { error: 'week_start is required (format: YYYY-MM-DD, must be Monday)' },
        { status: 400 }
      );
    }

    const weekDate = new Date(week_start + 'T00:00:00Z');
    if (isNaN(weekDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for week_start' },
        { status: 400 }
      );
    }

    if (weekDate.getDay() !== 1) {
      return NextResponse.json(
        { error: 'week_start must be a Monday' },
        { status: 400 }
      );
    }

    console.log(`[Roster Generation] Starting for week: ${week_start}`);
    console.log(`  Max hours per week: ${max_hours_per_week}`);
    console.log(`  Prefer fairness: ${prefer_fairness}`);
    console.log(`  AI Model: ${model}`);

    // Generate roster using AI solver (automatically fetches rules and staff)
    const solution = await RosterSolverService.generateRoster({
      weekStart: week_start,
      maxHoursPerWeek: max_hours_per_week,
      preferFairness: prefer_fairness,
      model
    });

    const generationTime = Date.now() - startTime;

    console.log(`[Roster Generation] Completed in ${generationTime}ms`);
    console.log(`  Total shifts: ${solution.assignments.length}`);
    console.log(`  Score: ${solution.score}`);
    console.log(`  Valid: ${solution.is_valid}`);
    console.log(`  Violations: ${solution.violations.length}`);

    // Validate solution
    const validation = RosterSolverService.validateSolution(solution);

    // Calculate unique staff count
    const uniqueStaff = new Set(solution.assignments.map(a => a.staff_id)).size;

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

    // Build assignments with staff names (fetch from database)
    const client = await pool.connect();
    let assignmentsWithNames;
    try {
      const staffIds = Array.from(new Set(solution.assignments.map(a => a.staff_id)));
      const staffResult = await client.query(`
        SELECT id, staff_name, nickname
        FROM staff_list
        WHERE id = ANY($1)
      `, [staffIds]);

      const staffMap = new Map(staffResult.rows.map(r => [r.id, r.nickname || r.staff_name]));

      assignmentsWithNames = solution.assignments.map(assignment => ({
        staff_id: assignment.staff_id,
        staff_name: staffMap.get(assignment.staff_id) || 'Unknown',
        day_of_week: assignment.shift_requirement.day_of_week,
        shift_type: assignment.shift_requirement.shift_type,
        scheduled_start: assignment.shift_requirement.scheduled_start,
        scheduled_end: assignment.shift_requirement.scheduled_end,
        role_required: assignment.shift_requirement.role_required,
        score: assignment.score
      }));
    } finally {
      client.release();
    }

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
      stats: {
        total_shifts: solution.assignments.length,
        unique_staff: uniqueStaff,
        generation_time_ms: generationTime,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[Roster Generation] Error:', error);
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
 * Preview shift requirements that would be generated from rules
 *
 * Query params:
 * - week_start: ISO date string (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week_start = searchParams.get('week_start');

    if (!week_start) {
      // Return system info if no week_start provided
      const rules = await RosterSolverService.fetchActiveRules();

      const staffResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM staff_list
        WHERE active = true
      `);
      const staffCount = parseInt(staffResult.rows[0].count);

      return NextResponse.json({
        capabilities: {
          natural_language_rules: true,
          constraint_solving: true,
          fairness_optimization: true,
          auto_staff_assignment: true
        },
        configuration: {
          active_rules: rules.length,
          active_staff: staffCount
        },
        supported_constraint_types: [
          'min_coverage', 'max_coverage', 'opening_time', 'min_shift_length',
          'no_day_and_night', 'min_hours', 'max_hours', 'day_off',
          'max_consecutive_days', 'staff_pairing', 'required_role',
          'required_skill', 'fairness', 'weekly_frequency'
        ],
        example_request: {
          week_start: '2025-01-13',
          max_hours_per_week: 40,
          prefer_fairness: true
        }
      });
    }

    // Preview shift requirements for specific week
    const rules = await RosterSolverService.fetchActiveRules();
    const shiftRequirements = await RosterSolverService.generateShiftRequirementsFromRules(
      rules,
      week_start
    );

    return NextResponse.json({
      week_start,
      rules: rules.map(r => ({
        id: r.id,
        rule_text: r.rule_text,
        weight: r.weight,
        constraint_type: r.parsed_constraint.type
      })),
      shift_requirements: shiftRequirements.map(sr => ({
        day: sr.day_of_week,
        shift_type: sr.shift_type,
        start: sr.scheduled_start,
        end: sr.scheduled_end,
        min_staff: sr.min_staff,
        role: sr.role_required,
        requires_keys: sr.requires_keys
      })),
      stats: {
        total_rules: rules.length,
        total_shifts_to_fill: shiftRequirements.length
      }
    });

  } catch (error: any) {
    console.error('[Roster Preview] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate preview',
        details: error.message
      },
      { status: 500 }
    );
  }
}
