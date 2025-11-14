/**
 * Roster Rules API
 * Endpoints for managing roster generation rules
 *
 * GET    /api/roster/rules           - List all rules
 * POST   /api/roster/rules           - Create new rule (parses with Claude)
 * PUT    /api/roster/rules/[id]      - Update rule
 * DELETE /api/roster/rules/[id]      - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/postgres';
import RuleParserService from '@/lib/services/rule-parser-service';

/**
 * GET /api/roster/rules
 * List all roster rules with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') === 'true';
    const constraintType = searchParams.get('constraint_type');

    let query = 'SELECT * FROM roster_rules WHERE 1=1';
    const params: any[] = [];

    if (activeOnly) {
      query += ' AND is_active = true';
    }

    if (constraintType) {
      params.push(constraintType);
      query += ` AND parsed_constraint->>'type' = $${params.length}`;
    }

    query += ' ORDER BY weight DESC, created_at DESC';

    const result = await pool.query(query, params);

    // JSONB fields are already parsed by pg driver
    const rules = result.rows;

    return NextResponse.json({
      rules,
      count: rules.length
    });

  } catch (error) {
    console.error('Error fetching roster rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch roster rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/rules
 * Create a new roster rule with Claude API parsing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rule_text,
      suggested_priority,
      created_by = null // Optional UUID
    } = body;

    if (!rule_text) {
      return NextResponse.json(
        { error: 'rule_text is required' },
        { status: 400 }
      );
    }

    // Fetch staff context for name→ID mapping
    const staffResult = await pool.query('SELECT id, staff_name, nickname FROM staff_list');
    const staffContext = staffResult.rows.map(row => ({
      id: row.id,
      staff_name: row.nickname || row.staff_name
    }));

    // Parse rule using Claude API
    console.log(`[Rule Parser] Parsing rule: "${rule_text}"`);
    const parseResult = await RuleParserService.parseRule(rule_text, staffContext);

    if (!parseResult.success || !parseResult.parsed_constraint) {
      return NextResponse.json(
        {
          error: 'Failed to parse rule',
          details: parseResult.error,
          suggestion: 'Please rephrase the rule or provide more specific details'
        },
        { status: 400 }
      );
    }

    const constraint = parseResult.parsed_constraint;

    // Validate constraint
    const validation = RuleParserService.validateConstraint(constraint);
    if (!validation.is_valid) {
      return NextResponse.json(
        {
          error: 'Invalid constraint',
          validation_errors: validation.errors
        },
        { status: 400 }
      );
    }

    // Determine weight (use suggested priority or Claude's weight)
    const priorityWeights: Record<string, number> = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25
    };

    const weight = suggested_priority
      ? priorityWeights[suggested_priority] || parseResult.suggested_weight
      : parseResult.suggested_weight;

    // Store in database
    const insertResult = await pool.query(`
      INSERT INTO roster_rules (
        rule_text,
        parsed_constraint,
        weight,
        is_active,
        created_by
      ) VALUES ($1, $2, $3, true, $4)
      RETURNING *
    `, [
      rule_text,
      constraint,
      weight,
      created_by
    ]);

    const newRule = insertResult.rows[0];

    console.log(`[Rule Parser] Successfully created rule: ${constraint.type} (weight: ${weight})`);

    return NextResponse.json({
      success: true,
      rule: {
        ...newRule,
        parsed_constraint: newRule.parsed_constraint // Already JSONB, no need to parse
      },
      parsing_details: {
        constraint_type: constraint.type,
        suggested_weight: parseResult.suggested_weight,
        applied_weight: weight,
        explanation: parseResult.explanation
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating roster rule:', error);
    return NextResponse.json(
      {
        error: 'Failed to create roster rule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roster/rules
 * Batch update rules (activate/deactivate, change weights)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rule_id, updates } = body;

    if (!rule_id) {
      return NextResponse.json(
        { error: 'rule_id is required' },
        { status: 400 }
      );
    }

    const allowedUpdates = ['weight', 'is_active', 'expires_at'];
    const updateFields = Object.keys(updates).filter(key => allowedUpdates.includes(key));

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    // Build dynamic UPDATE query
    const setClauses = updateFields.map((field, index) => `${field} = $${index + 2}`);
    const query = `
      UPDATE roster_rules
      SET ${setClauses.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const params = [rule_id, ...updateFields.map(field => updates[field])];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    const updatedRule = result.rows[0];

    return NextResponse.json({
      success: true,
      rule: {
        ...updatedRule,
        parsed_constraint: updatedRule.parsed_constraint // Already JSONB
      }
    });

  } catch (error) {
    console.error('Error updating roster rule:', error);
    return NextResponse.json(
      { error: 'Failed to update roster rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roster/rules
 * Delete a roster rule
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('rule_id');

    if (!ruleId) {
      return NextResponse.json(
        { error: 'rule_id is required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'DELETE FROM roster_rules WHERE id = $1 RETURNING id',
      [ruleId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rule deleted successfully',
      rule_id: ruleId
    });

  } catch (error) {
    console.error('Error deleting roster rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete roster rule' },
      { status: 500 }
    );
  }
}
