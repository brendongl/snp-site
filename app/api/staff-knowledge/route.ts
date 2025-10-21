import { NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = DatabaseService.getInstance();

    // Fetch all staff knowledge records from PostgreSQL
    console.log('Fetching staff knowledge from PostgreSQL...');
    const allKnowledge = await db.staffKnowledge.getAllKnowledge();

    console.log(`✅ Fetched ${allKnowledge.length} staff knowledge records from PostgreSQL`);

    return NextResponse.json({ knowledge: allKnowledge });
  } catch (error) {
    console.error('❌ Staff knowledge API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch staff knowledge';
    return NextResponse.json(
      { error: `Failed to fetch staff knowledge: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const db = DatabaseService.getInstance();

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
    const db = DatabaseService.getInstance();

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
