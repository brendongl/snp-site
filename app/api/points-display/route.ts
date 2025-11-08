/**
 * GET /api/points-display - Public endpoint to fetch point values for UI display
 *
 * Returns simplified point values that can be used by staff-facing UI components
 * to show dynamic point awards (e.g., "+150" on Play Log button)
 */

import { NextResponse } from 'next/server';
import { calculatePoints } from '@/lib/services/points-service';

export const dynamic = 'force-dynamic';

/**
 * GET - Fetch display point values for common actions
 */
export async function GET() {
  try {
    // Calculate points for each common action
    // Use complexity=1 as the base for display purposes
    const pointValues = {
      play_log: await calculatePoints({
        staffId: '', // Not needed for calculation
        actionType: 'play_log',
        metadata: {}
      }),
      content_check_base: await calculatePoints({
        staffId: '',
        actionType: 'content_check',
        metadata: { gameComplexity: 1 }
      }),
      knowledge_add_beginner: await calculatePoints({
        staffId: '',
        actionType: 'knowledge_add',
        metadata: { knowledgeLevel: 1, gameComplexity: 1 }
      }),
      knowledge_add_intermediate: await calculatePoints({
        staffId: '',
        actionType: 'knowledge_add',
        metadata: { knowledgeLevel: 2, gameComplexity: 1 }
      }),
      knowledge_add_expert: await calculatePoints({
        staffId: '',
        actionType: 'knowledge_add',
        metadata: { knowledgeLevel: 3, gameComplexity: 1 }
      }),
      knowledge_add_instructor: await calculatePoints({
        staffId: '',
        actionType: 'knowledge_add',
        metadata: { knowledgeLevel: 4, gameComplexity: 1 }
      }),
      knowledge_upgrade: await calculatePoints({
        staffId: '',
        actionType: 'knowledge_upgrade',
        metadata: { gameComplexity: 1 }
      }),
      teaching: await calculatePoints({
        staffId: '',
        actionType: 'teaching',
        metadata: { gameComplexity: 1 }
      }),
      photo_upload: await calculatePoints({
        staffId: '',
        actionType: 'photo_upload',
        metadata: {}
      }),
      issue_report: await calculatePoints({
        staffId: '',
        actionType: 'issue_report',
        metadata: {}
      }),
      issue_resolution_basic: await calculatePoints({
        staffId: '',
        actionType: 'issue_resolution',
        metadata: { gameComplexity: 1 }
      }),
      issue_resolution_complex: await calculatePoints({
        staffId: '',
        actionType: 'issue_resolution',
        metadata: { gameComplexity: 3 }
      }),
    };

    return NextResponse.json({
      success: true,
      points: pointValues
    });

  } catch (error) {
    console.error('Error fetching points display values:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch points display values',
        success: false,
        // Return fallback values
        points: {
          play_log: 100,
          content_check_base: 1000,
          knowledge_add_beginner: 100,
          knowledge_add_intermediate: 200,
          knowledge_add_expert: 300,
          knowledge_add_instructor: 500,
          knowledge_upgrade: 100,
          teaching: 1000,
          photo_upload: 1000,
          issue_report: 100,
          issue_resolution_basic: 500,
          issue_resolution_complex: 1000,
        }
      },
      { status: 200 } // Return 200 even on error with fallback values
    );
  }
}
