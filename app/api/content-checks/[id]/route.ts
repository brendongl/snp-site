import { NextRequest, NextResponse } from 'next/server';
import DatabaseService from '@/lib/services/db-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Content check ID is required' },
        { status: 400 }
      );
    }

    // Delete the content check from PostgreSQL
    const db = DatabaseService.initialize();
    await db.contentChecks.deleteCheck(id);

    return NextResponse.json({
      success: true,
      message: 'Content check deleted successfully',
      id,
    });
  } catch (error) {
    console.error('Error deleting content check:', error);
    return NextResponse.json(
      { error: 'Failed to delete content check' },
      { status: 500 }
    );
  }
}
