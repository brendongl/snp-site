/**
 * API Route: /api/roster/rules/parse
 * Version: 2.0.0
 * Phase 2: Natural Language Rule Parsing
 *
 * POST: Parse natural language rule into structured constraint
 */

import { NextRequest, NextResponse } from 'next/server';
import RuleParserService from '@/lib/services/rule-parser-service';
import RosterDbService from '@/lib/services/roster-db-service';
import pool from '@/lib/db/postgres';

/**
 * POST /api/roster/rules/parse
 * Parse natural language scheduling rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rule_text,
      created_by,
      auto_save = false,
      expires_at
    } = body;

    if (!rule_text) {
      return NextResponse.json(
        { error: 'rule_text is required' },
        { status: 400 }
      );
    }

    // Get staff context for better parsing
    const client = await pool.connect();
    let staffContext: any[] = [];
    try {
      const staffResult = await client.query(`
        SELECT id, staff_name
        FROM staff_list
        WHERE base_hourly_rate IS NOT NULL
        ORDER BY staff_name
      `);
      staffContext = staffResult.rows;
    } finally {
      client.release();
    }

    // Parse the rule using Claude API
    console.log(`🤖 Parsing rule: "${rule_text}"`);
    const parseResult = await RuleParserService.parseRule(rule_text, staffContext);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse rule',
          details: parseResult.error
        },
        { status: 400 }
      );
    }

    // Validate parsed constraint
    const validation = RuleParserService.validateConstraint(parseResult.parsed_constraint!);
    if (!validation.is_valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid constraint structure',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Auto-save if requested
    let saved = false;
    let ruleId: string | null = null;

    if (auto_save) {
      console.log('   💾 Auto-saving rule to database...');

      if (!created_by) {
        return NextResponse.json(
          { error: 'created_by (staff_id) is required for auto_save' },
          { status: 400 }
        );
      }

      const rule = await RosterDbService.createRule(
        rule_text,
        parseResult.parsed_constraint!,
        parseResult.suggested_weight,
        created_by,
        expires_at || null
      );

      saved = true;
      ruleId = rule.id;
      console.log(`   ✅ Rule saved with ID: ${ruleId}`);
    }

    return NextResponse.json({
      success: true,
      rule: {
        id: ruleId,
        original_text: rule_text,
        parsed_constraint: parseResult.parsed_constraint,
        suggested_weight: parseResult.suggested_weight,
        explanation: parseResult.explanation,
        human_readable: RuleParserService.describeConstraint(parseResult.parsed_constraint!),
        validation
      },
      saved,
      parsed_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error parsing rule:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse rule',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/roster/rules/parse
 * Get example rules and documentation
 */
export async function GET(request: NextRequest) {
  try {
    const examples = RuleParserService.getExampleRules();

    return NextResponse.json({
      description: 'Natural language rule parser using Claude API',
      supported_constraint_types: [
        {
          type: 'max_hours',
          description: 'Maximum hours per week for a staff member',
          example: 'John should work no more than 35 hours per week'
        },
        {
          type: 'min_hours',
          description: 'Minimum hours per week for a staff member',
          example: 'Sarah needs at least 20 hours weekly'
        },
        {
          type: 'preferred_hours',
          description: 'Preferred hour range for a staff member',
          example: 'Mike prefers to work between 25 and 30 hours'
        },
        {
          type: 'max_consecutive_days',
          description: 'Maximum consecutive working days',
          example: 'No one should work more than 5 days in a row'
        },
        {
          type: 'day_off',
          description: 'Staff member unavailable on specific day',
          example: 'Emily has Mondays off'
        },
        {
          type: 'no_back_to_back',
          description: 'No back-to-back shift types',
          example: 'No one should close one day and open the next'
        },
        {
          type: 'requires_keys_for_opening',
          description: 'Opening shifts require keys',
          example: 'All opening shifts need staff with keys'
        },
        {
          type: 'fairness',
          description: 'Distribute hours evenly',
          example: 'Keep hour distribution fair within 10 hours'
        }
      ],
      example_rules: examples,
      example_request: {
        rule_text: 'Brendon should work no more than 35 hours per week',
        created_by: '<staff_uuid>',
        auto_save: false,
        expires_at: '2025-12-31'
      },
      usage: 'POST with { rule_text, created_by?, auto_save?, expires_at? }'
    });
  } catch (error: any) {
    console.error('Error getting rule parser info:', error);
    return NextResponse.json(
      {
        error: 'Failed to get rule parser info',
        details: error.message
      },
      { status: 500 }
    );
  }
}
