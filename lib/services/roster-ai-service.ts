/**
 * Service: AI-Powered Roster Generator
 * Version: 1.10.12
 * Uses Claude Sonnet 4.5 via OpenRouter to generate optimal staff rosters
 *
 * Replaces the constraint satisfaction solver with AI reasoning
 */

import pool from '@/lib/db/postgres';
import type { RosterShift } from '@/types';

// ========================================
// Types
// ========================================

export interface StaffMember {
  id: string;
  name: string;
  nickname?: string;
  base_hourly_rate?: number;
  has_keys?: boolean;
  available_roles?: string[];
  availability: AvailabilityPattern[];
}

export interface AvailabilityPattern {
  day_of_week: string;
  hour_start: number;
  hour_end: number;
  availability_status: 'available' | 'preferred_not' | 'unavailable';
}

export interface RosterRule {
  id: string;
  rule_text: string;
  parsed_constraint: any;
  weight: number;
  is_active: boolean;
}

export interface RosterHours {
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_active: boolean;
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

export interface GenerateRosterParams {
  weekStart: string;
  staffMembers: StaffMember[];
  shiftRequirements: ShiftRequirement[];
  rules: RosterRule[];
  rosterHours: RosterHours[];
  maxHoursPerWeek?: number;
  preferFairness?: boolean;
}

export interface RosterSolution {
  assignments: ShiftAssignment[];
  score: number;
  violations: ConstraintViolation[];
  is_valid: boolean;
  ai_explanation?: string;
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

// ========================================
// AI Roster Generator
// ========================================

export default class AIRosterService {
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
   * Generate roster using Claude Sonnet 4.5
   */
  static async generateRoster(params: GenerateRosterParams): Promise<RosterSolution> {
    try {
      console.log('[AI Roster] Starting roster generation with Sonnet 4.5...');

      const apiKey = this.getApiKey();

      // Build comprehensive context for AI
      const prompt = this.buildRosterPrompt(params);

      console.log('[AI Roster] Sending request to OpenRouter...');

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sipnplay.cafe',
          'X-Title': 'Sip N Play Roster System',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5-20250929', // Claude Sonnet 4.5
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 8000,
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

      console.log('[AI Roster] Parsing AI response...');
      console.log('[AI Roster] Raw response length:', content.length);

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = content;

      // Remove markdown code blocks if present
      if (content.includes('```json')) {
        const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonBlockMatch) {
          jsonText = jsonBlockMatch[1];
        }
      } else if (content.includes('```')) {
        const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        }
      }

      // Extract JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[AI Roster] Failed to find JSON in response:', content.substring(0, 500));
        throw new Error('No JSON found in AI response');
      }

      console.log('[AI Roster] Extracted JSON length:', jsonMatch[0].length);

      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError: any) {
        console.error('[AI Roster] JSON parse error:', parseError.message);
        console.error('[AI Roster] Attempted to parse:', jsonMatch[0].substring(0, 500));
        throw new Error(`Failed to parse AI response: ${parseError.message}`);
      }

      // Convert AI response to RosterSolution format
      const solution = this.convertAIResponseToSolution(parsed, params);

      console.log(`[AI Roster] Generated ${solution.assignments.length} shift assignments`);
      console.log(`[AI Roster] Violations: ${solution.violations.length}`);

      return solution;

    } catch (error: any) {
      console.error('[AI Roster] Error generating roster:', error);

      // Return empty solution on error
      return {
        assignments: [],
        score: 0,
        violations: [{
          type: 'hard',
          constraint: 'AI_GENERATION_ERROR',
          message: `Failed to generate roster: ${error.message}`,
          severity: 1000
        }],
        is_valid: false,
        ai_explanation: error.message
      };
    }
  }

  /**
   * Build comprehensive prompt for AI roster generation
   */
  private static buildRosterPrompt(params: GenerateRosterParams): string {
    const { weekStart, staffMembers, shiftRequirements, rules, rosterHours, maxHoursPerWeek = 40 } = params;

    // Format roster hours
    const rosterHoursText = rosterHours.map(h =>
      `  ${h.day_of_week}: ${h.open_time} - ${h.close_time}`
    ).join('\n');

    // Format staff availability
    const staffText = staffMembers.map(staff => {
      const availText = staff.availability
        .filter(a => a.availability_status !== 'unavailable')
        .map(a => `    ${a.day_of_week}: ${a.hour_start}:00-${a.hour_end}:00 (${a.availability_status})`)
        .join('\n');

      return `  - ${staff.nickname || staff.name} (ID: ${staff.id})
    Keys: ${staff.has_keys ? 'Yes' : 'No'}
    Roles: ${staff.available_roles?.join(', ') || 'general'}
    Availability:
${availText || '    (No availability set)'}`;
    }).join('\n\n');

    // Format shift requirements
    const shiftsText = shiftRequirements.map(shift =>
      `  ${shift.day_of_week} ${shift.scheduled_start}-${shift.scheduled_end} (${shift.shift_type}, role: ${shift.role_required}, keys: ${shift.requires_keys ? 'required' : 'not required'})`
    ).join('\n');

    // Format rules (only active rules with weight >= 100 are hard constraints)
    const hardRulesText = rules
      .filter(r => r.is_active && r.weight >= 100)
      .map(r => `  - ${r.rule_text} (weight: ${r.weight})`)
      .join('\n');

    const softRulesText = rules
      .filter(r => r.is_active && r.weight < 100)
      .map(r => `  - ${r.rule_text} (weight: ${r.weight})`)
      .join('\n');

    return `You are a staff scheduling expert. Generate an optimal weekly staff roster.

WEEK: ${weekStart}

DAILY OPEN/CLOSE HOURS (HARD CONSTRAINT - shifts MUST be within these hours):
${rosterHoursText}

STAFF MEMBERS (${staffMembers.length} total):
${staffText}

SHIFTS TO FILL (${shiftRequirements.length} total):
${shiftsText}

HARD CONSTRAINTS (MUST be satisfied - weight >= 100):
${hardRulesText || '  (None)'}

SOFT CONSTRAINTS (preferences - weight < 100):
${softRulesText || '  (None)'}

ADDITIONAL CONSTRAINTS:
- Maximum hours per week: ${maxHoursPerWeek}h per staff member
- Staff CANNOT be assigned overlapping shifts
- Shifts MUST start at or after open_time and end at or before close_time for that day
- Staff MUST be available during assigned shift hours
- Opening/closing shifts require keys (has_keys: true)
- Distribute hours fairly across staff when possible

TASK:
Generate shift assignments that satisfy ALL hard constraints and as many soft constraints as possible.

RESPONSE FORMAT - Return ONLY the JSON object below (no markdown, no code blocks, no explanation text):
{
  "assignments": [
    {
      "staff_id": "uuid-here",
      "staff_name": "Name",
      "day_of_week": "Monday",
      "shift_start": "12:00",
      "shift_end": "18:00",
      "shift_type": "day",
      "role": "general"
    }
  ],
  "violations": [
    {
      "type": "soft",
      "constraint": "FAIRNESS",
      "staff_name": "Name",
      "message": "Staff assigned 35h while others have 25h",
      "severity": 10
    }
  ],
  "explanation": "Brief explanation of assignment strategy",
  "total_staff_hours": {
    "staff_name": 35.0
  }
}

CRITICAL REQUIREMENTS:
- Assign each shift to exactly ONE staff member
- Match staff_id, day_of_week, shift times, and shift_type exactly from SHIFTS TO FILL above
- Only assign staff to shifts they're available for
- Respect all hard constraints (weight >= 100)
- Staff CANNOT have overlapping shifts on the same day
- Shifts MUST be within daily open/close hours
- Return ONLY the JSON object above, starting with { and ending with }
- NO markdown formatting, NO code blocks (no \`\`\`json), NO extra text`;
  }

  /**
   * Convert AI response to RosterSolution format
   */
  private static convertAIResponseToSolution(
    aiResponse: any,
    params: GenerateRosterParams
  ): RosterSolution {
    const assignments: ShiftAssignment[] = [];
    const violations: ConstraintViolation[] = [];

    // Map AI assignments to our format
    if (aiResponse.assignments && Array.isArray(aiResponse.assignments)) {
      for (const aiAssignment of aiResponse.assignments) {
        // Find matching shift requirement
        const shiftReq = params.shiftRequirements.find(req =>
          req.day_of_week === aiAssignment.day_of_week &&
          req.scheduled_start === aiAssignment.shift_start &&
          req.scheduled_end === aiAssignment.shift_end &&
          req.shift_type === aiAssignment.shift_type
        );

        if (shiftReq) {
          assignments.push({
            staff_id: aiAssignment.staff_id,
            shift_requirement: shiftReq,
            score: 100 // AI-generated, assume optimal
          });
        } else {
          console.warn('[AI Roster] Could not match AI assignment to shift requirement:', aiAssignment);
        }
      }
    }

    // Map violations
    if (aiResponse.violations && Array.isArray(aiResponse.violations)) {
      for (const aiViolation of aiResponse.violations) {
        violations.push({
          type: aiViolation.type || 'soft',
          constraint: aiViolation.constraint || 'UNKNOWN',
          staff_id: aiViolation.staff_id,
          message: aiViolation.message || 'Unknown violation',
          severity: aiViolation.severity || 50
        });
      }
    }

    // Calculate overall score (higher is better)
    const hardViolations = violations.filter(v => v.type === 'hard').length;
    const softViolations = violations.filter(v => v.type === 'soft').length;
    const score = 1000 - (hardViolations * 100) - (softViolations * 10);

    return {
      assignments,
      score,
      violations,
      is_valid: hardViolations === 0,
      ai_explanation: aiResponse.explanation || 'AI-generated roster'
    };
  }
}
