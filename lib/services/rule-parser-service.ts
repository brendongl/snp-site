/**
 * Service: Rule Parser with Claude API via OpenRouter
 * Version: 2.1.0
 * Phase 2: Natural Language Rule Parsing
 *
 * Converts natural language scheduling rules into structured constraints
 * using Claude API through OpenRouter.
 */

// Using fetch directly for OpenRouter compatibility

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
  /**
   * Get OpenRouter API key
   */
  private static getApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured in environment');
    }
    return apiKey;
  }

  /**
   * Parse natural language rule into structured constraint
   */
  static async parseRule(ruleText: string, staffContext?: any[]): Promise<RuleParseResult> {
    try {
      const apiKey = this.getApiKey();

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

COVERAGE CONSTRAINTS:
1. min_coverage: Minimum staff count at all times or specific time ranges
   Format: { type: "min_coverage", min_staff: number, time_range?: "all" | {start: "HH:MM", end: "HH:MM"}, days?: string[] }
   Example: { type: "min_coverage", min_staff: 2, time_range: "all" }

2. max_coverage: Maximum staff count for specific time ranges
   Format: { type: "max_coverage", max_staff: number, time_range: {start: "HH:MM", end: "HH:MM"}, days?: string[] }
   Example: { type: "max_coverage", max_staff: 2, time_range: {start: "12:00", end: "15:00"}, days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }

SCHEDULE CONSTRAINTS:
3. opening_time: Required opening time for specific days
   Format: { type: "opening_time", time: "HH:MM", days: string[] }
   Example: { type: "opening_time", time: "12:00", days: ["Monday", "Wednesday"] }

4. min_shift_length: Minimum shift duration
   Format: { type: "min_shift_length", min_hours: number }
   Example: { type: "min_shift_length", min_hours: 5 }

5. no_day_and_night: Staff cannot work both day and night shifts on same day
   Format: { type: "no_day_and_night", day_end_hour: number, night_start_hour: number }
   Example: { type: "no_day_and_night", day_end_hour: 18, night_start_hour: 18 }

INDIVIDUAL CONSTRAINTS:
6. min_hours: Minimum hours per week for specific staff
   Format: { type: "min_hours", staff_id: "uuid", staff_name: string, min_hours: number }
   Example: { type: "min_hours", staff_name: "Tho", min_hours: 40 }

7. max_hours: Maximum hours per week for staff
   Format: { type: "max_hours", staff_id: "uuid", staff_name: string, max_hours: number }

8. day_off: Staff unavailable on specific day
   Format: { type: "day_off", staff_id: "uuid", staff_name: string, day_of_week: string }

9. max_consecutive_days: Maximum consecutive working days
   Format: { type: "max_consecutive_days", staff_id: "uuid", staff_name: string, max_days: number }

RELATIONSHIP CONSTRAINTS:
10. staff_pairing: Staff should/shouldn't work together
   Format: { type: "staff_pairing", staff1_name: string, staff2_name: string, constraint: "no_overlap" | "must_overlap" }
   Example: { type: "staff_pairing", staff1_name: "Nhi", staff2_name: "Hieu", constraint: "no_overlap" }

ROLE CONSTRAINTS:
11. required_role: Specific role required at certain times
   Format: { type: "required_role", role: string, time_range?: {start: "HH:MM", end: "HH:MM"}, days?: string[], count?: number }
   Example: { type: "required_role", role: "game master", days: ["Friday", "Saturday", "Sunday"], time_range: {start: "18:00", end: "23:59"} }

12. required_skill: Minimum skill level required at all times
   Format: { type: "required_skill", skill: string, level: "expert" | "intermediate" | "beginner", min_count: number }
   Example: { type: "required_skill", skill: "barista", level: "expert", min_count: 1 }

OTHER CONSTRAINTS:
13. fairness: Distribute hours evenly
   Format: { type: "fairness", max_hour_difference: number }

14. weekly_frequency: Minimum times scheduled per week
   Format: { type: "weekly_frequency", min_days_per_week: number }
   Example: { type: "weekly_frequency", min_days_per_week: 1 }

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

      // Call OpenRouter API using Anthropic format
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sipnplay.cafe',
          'X-Title': 'Sip N Play Roster System',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-haiku',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `Parse this scheduling rule: "${ruleText}"`
            }
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${error}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenRouter response');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
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
