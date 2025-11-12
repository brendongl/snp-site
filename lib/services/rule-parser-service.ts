/**
 * Service: Rule Parser with Claude API
 * Version: 2.0.0
 * Phase 2: Natural Language Rule Parsing
 *
 * Converts natural language scheduling rules into structured constraints
 * using Claude API (Anthropic).
 */

import Anthropic from '@anthropic-ai/sdk';

// ========================================
// Types
// ========================================

export interface ParsedConstraint {
  type: string;
  staff_id?: string;
  staff_name?: string;
  day_of_week?: string;
  shift_type?: string;
  min_hours?: number;
  max_hours?: number;
  max_days?: number;
  max_consecutive_days?: number;
  requires_keys?: boolean;
  preferred_hours?: { min: number; max: number };
  [key: string]: any;
}

export interface RuleParseResult {
  success: boolean;
  parsed_constraint: ParsedConstraint | null;
  suggested_weight: number;
  explanation: string;
  original_rule: string;
  error?: string;
}

// ========================================
// Rule Parser Service
// ========================================

export default class RuleParserService {
  private static anthropic: Anthropic | null = null;

  /**
   * Initialize Anthropic client
   */
  private static getClient(): Anthropic {
    if (!this.anthropic) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured in environment');
      }
      this.anthropic = new Anthropic({ apiKey });
    }
    return this.anthropic;
  }

  /**
   * Parse natural language rule into structured constraint
   */
  static async parseRule(ruleText: string, staffContext?: any[]): Promise<RuleParseResult> {
    try {
      const client = this.getClient();

      // Build context about staff members
      let staffContextText = '';
      if (staffContext && staffContext.length > 0) {
        staffContextText = '\n\nAvailable staff members:\n';
        for (const staff of staffContext) {
          staffContextText += `- ${staff.staff_name} (ID: ${staff.id})\n`;
        }
      }

      const systemPrompt = `You are a scheduling constraint parser. Convert natural language scheduling rules into structured JSON constraints.

${staffContextText}

Constraint Types:
1. max_hours: Maximum hours per week for a staff member
   Format: { type: "max_hours", staff_id: "uuid", max_hours: number }

2. min_hours: Minimum hours per week for a staff member
   Format: { type: "min_hours", staff_id: "uuid", min_hours: number }

3. preferred_hours: Preferred hour range for a staff member
   Format: { type: "preferred_hours", staff_id: "uuid", min_hours: number, max_hours: number }

4. max_consecutive_days: Maximum consecutive working days
   Format: { type: "max_consecutive_days", staff_id: "uuid", max_days: number }

5. day_off: Staff member unavailable on specific day
   Format: { type: "day_off", staff_id: "uuid", day_of_week: "Monday"|"Tuesday"|etc }

6. no_back_to_back: No back-to-back shift types (e.g., closing then opening)
   Format: { type: "no_back_to_back", shift_types: ["closing", "opening"] }

7. requires_keys_for_opening: Opening shifts require staff with keys
   Format: { type: "requires_keys_for_opening", requires_keys: true }

8. fairness: Distribute hours evenly
   Format: { type: "fairness", max_hour_difference: number }

Weight Guidelines (0-100):
- Hard constraints (must be satisfied): 90-100
- Important preferences: 60-80
- Nice-to-have preferences: 30-50
- Minor preferences: 10-20

Return JSON format:
{
  "constraint": { ... constraint object ... },
  "weight": number,
  "explanation": "Brief explanation of what this rule does"
}`;

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Parse this scheduling rule: "${ruleText}"`
          }
        ]
      });

      // Extract JSON from response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        parsed_constraint: parsed.constraint,
        suggested_weight: parsed.weight,
        explanation: parsed.explanation,
        original_rule: ruleText
      };
    } catch (error: any) {
      console.error('Error parsing rule with Claude:', error);
      return {
        success: false,
        parsed_constraint: null,
        suggested_weight: 50,
        explanation: '',
        original_rule: ruleText,
        error: error.message
      };
    }
  }

  /**
   * Parse multiple rules in batch
   */
  static async parseRules(
    rules: string[],
    staffContext?: any[]
  ): Promise<RuleParseResult[]> {
    const results: RuleParseResult[] = [];

    for (const rule of rules) {
      const result = await this.parseRule(rule, staffContext);
      results.push(result);

      // Add small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Validate a parsed constraint structure
   */
  static validateConstraint(constraint: ParsedConstraint): {
    is_valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!constraint.type) {
      errors.push('Constraint must have a type field');
      return { is_valid: false, errors };
    }

    // Type-specific validation
    switch (constraint.type) {
      case 'max_hours':
      case 'min_hours':
        if (!constraint.staff_id) {
          errors.push('staff_id is required for hours constraints');
        }
        if (constraint.max_hours !== undefined && constraint.max_hours < 0) {
          errors.push('max_hours must be non-negative');
        }
        if (constraint.min_hours !== undefined && constraint.min_hours < 0) {
          errors.push('min_hours must be non-negative');
        }
        break;

      case 'preferred_hours':
        if (!constraint.staff_id) {
          errors.push('staff_id is required for preferred_hours constraint');
        }
        if (constraint.min_hours === undefined || constraint.max_hours === undefined) {
          errors.push('Both min_hours and max_hours required for preferred_hours');
        } else if (constraint.min_hours > constraint.max_hours) {
          errors.push('min_hours cannot exceed max_hours');
        }
        break;

      case 'max_consecutive_days':
        if (!constraint.staff_id) {
          errors.push('staff_id is required for max_consecutive_days constraint');
        }
        if (!constraint.max_days || constraint.max_days < 1 || constraint.max_days > 7) {
          errors.push('max_days must be between 1 and 7');
        }
        break;

      case 'day_off':
        if (!constraint.staff_id) {
          errors.push('staff_id is required for day_off constraint');
        }
        const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        if (!constraint.day_of_week || !validDays.includes(constraint.day_of_week)) {
          errors.push('day_of_week must be a valid day name');
        }
        break;

      case 'no_back_to_back':
        if (!constraint.shift_types || !Array.isArray(constraint.shift_types) || constraint.shift_types.length !== 2) {
          errors.push('shift_types must be an array of exactly 2 shift types');
        }
        break;

      case 'requires_keys_for_opening':
        if (constraint.requires_keys !== true) {
          errors.push('requires_keys must be true for this constraint');
        }
        break;

      case 'fairness':
        if (!constraint.max_hour_difference || constraint.max_hour_difference < 0) {
          errors.push('max_hour_difference must be a positive number');
        }
        break;

      default:
        // Allow custom constraint types
        console.warn(`Unknown constraint type: ${constraint.type}`);
    }

    return {
      is_valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate example rules for testing/documentation
   */
  static getExampleRules(): string[] {
    return [
      'Brendon should work no more than 35 hours per week',
      'Phong prefers to work between 20 and 30 hours weekly',
      'Minh should not work more than 5 consecutive days',
      'All opening shifts require staff members with keys',
      'No one should close one day and open the next day',
      'Try to keep hour distribution fair (within 10 hours difference)',
      'Brendon has Mondays off',
      'Phong cannot work on Wednesdays'
    ];
  }

  /**
   * Convert parsed constraint to human-readable description
   */
  static describeConstraint(constraint: ParsedConstraint): string {
    switch (constraint.type) {
      case 'max_hours':
        return `Maximum ${constraint.max_hours} hours per week for ${constraint.staff_name || 'staff member'}`;

      case 'min_hours':
        return `Minimum ${constraint.min_hours} hours per week for ${constraint.staff_name || 'staff member'}`;

      case 'preferred_hours':
        return `Preferred ${constraint.min_hours}-${constraint.max_hours} hours per week for ${constraint.staff_name || 'staff member'}`;

      case 'max_consecutive_days':
        return `Maximum ${constraint.max_days} consecutive working days for ${constraint.staff_name || 'staff member'}`;

      case 'day_off':
        return `${constraint.staff_name || 'Staff member'} has ${constraint.day_of_week}s off`;

      case 'no_back_to_back':
        return `No back-to-back ${constraint.shift_types?.join(' and ')} shifts`;

      case 'requires_keys_for_opening':
        return 'Opening shifts require staff with keys';

      case 'fairness':
        return `Keep hour distribution fair (max ${constraint.max_hour_difference} hour difference)`;

      default:
        return `Custom constraint: ${constraint.type}`;
    }
  }
}
