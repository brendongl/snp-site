import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = DatabaseService.initialize();

    // Fetch all staff knowledge records with game names and staff names via JOIN
    console.log('Fetching staff knowledge with names from PostgreSQL...');
    const result = await db.pool.query(`
      SELECT
        sk.id,
        sk.staff_member_id,
        sk.game_id,
        sk.confidence_level,
        sk.can_teach,
        sk.taught_by,
        sk.notes,
        sk.created_at,
        sk.updated_at,
        g.name AS game_name,
        sl.staff_name AS staff_name
      FROM staff_knowledge sk
      LEFT JOIN games g ON sk.game_id = g.id
      LEFT JOIN staff_list sl ON sk.staff_member_id = sl.stafflist_id
      ORDER BY sk.created_at DESC
    `);

    // Map confidence level numbers to strings
    const confidenceLevelMap: { [key: number]: string } = {
      1: 'Beginner',
      2: 'Intermediate',
      3: 'Expert',
      4: 'Instructor',
    };

    const knowledge = result.rows.map((row) => ({
      id: row.id,
      staffMember: row.staff_name || 'Unknown Staff',
      gameName: row.game_name || 'Unknown Game',
      confidenceLevel: confidenceLevelMap[row.confidence_level] || 'Beginner',
      canTeach: row.can_teach || false,
      notes: row.notes || '',
      taughtBy: row.taught_by || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    console.log(`✅ Fetched ${knowledge.length} staff knowledge records with names from PostgreSQL`);

    return NextResponse.json({ knowledge });
  } catch (error) {
    console.error('❌ Staff knowledge API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch staff knowledge';
    return NextResponse.json(
      { error: `Failed to fetch staff knowledge: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const {
      gameId,
      staffRecordId,
      confidenceLevel,
      taughtBy,
      notes,
    } = await request.json();

    // Validate required fields
    if (!gameId || !staffRecordId || !confidenceLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, staffRecordId, confidenceLevel' },
        { status: 400 }
      );
    }

    // Map confidence level string to number
    const confidenceLevelMap: { [key: string]: number } = {
      'Beginner': 1,
      'Intermediate': 2,
      'Expert': 3,
      'Instructor': 4,
    };
    const confidenceLevelNum = confidenceLevelMap[confidenceLevel] || 1;

    // Create knowledge entry
    console.log(`[staff-knowledge POST] Creating knowledge: game=${gameId}, staff=${staffRecordId}`);

    const knowledge = await db.staffKnowledge.createKnowledge({
      staffMemberId: staffRecordId,
      gameId,
      confidenceLevel: confidenceLevelNum,
      canTeach: confidenceLevel === 'Expert' || confidenceLevel === 'Instructor',
      taughtBy: taughtBy || null,
      notes: notes || null,
    });

    console.log(`✅ Knowledge entry created: ${knowledge.id}`);

    return NextResponse.json(
      {
        success: true,
        knowledgeId: knowledge.id,
        knowledge,
        message: 'Knowledge entry created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ Error creating knowledge entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create knowledge entry';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Delete record from PostgreSQL
    console.log(`[staff-knowledge DELETE] Deleting knowledge entry: ${recordId}`);
    await db.staffKnowledge.deleteKnowledge(recordId);

    console.log(`✅ Knowledge entry deleted successfully: ${recordId}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Knowledge entry deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error deleting knowledge entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete knowledge entry';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const db = DatabaseService.initialize();

    const url = new URL(request.url);
    const recordId = url.searchParams.get('id');
    const { confidenceLevel, canTeach, notes } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: 'Missing record ID' },
        { status: 400 }
      );
    }

    // Update record in PostgreSQL
    console.log(`[staff-knowledge PATCH] Updating knowledge entry: ${recordId}`);

    const updates: any = {};
    if (confidenceLevel !== undefined) updates.confidenceLevel = confidenceLevel;
    if (canTeach !== undefined) updates.canTeach = canTeach;
    if (notes !== undefined) updates.notes = notes;

    const updatedKnowledge = await db.staffKnowledge.updateKnowledge(recordId, updates);

    console.log(`✅ Knowledge entry updated successfully: ${recordId}`);

    return NextResponse.json(
      {
        success: true,
        knowledge: updatedKnowledge,
        message: 'Knowledge entry updated successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error updating knowledge entry:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update knowledge entry';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
