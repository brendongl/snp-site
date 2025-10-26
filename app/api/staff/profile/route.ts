import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get session to identify current staff member
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Use DatabaseService singleton
    const db = DatabaseService.initialize();

    // Get staff member by email
    const staff = await db.staff.getStaffByEmail(session.user.email);

    if (!staff) {
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    // Get staff stats
    const stats = await db.staff.getStaffStats(staff.staffId);

    return NextResponse.json({
      profile: staff,
      stats,
    });
  } catch (error) {
    console.error('Error fetching staff profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
