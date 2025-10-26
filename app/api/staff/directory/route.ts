import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import DatabaseService from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Require authentication (staff only)
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Use efficient single-query method
    const db = DatabaseService.initialize();
    const allStaffWithStats = await db.staff.getAllStaffWithStats();

    // Map to public directory format (exclude sensitive fields)
    const directory = allStaffWithStats.map((staff) => ({
      staffId: staff.staffId,
      name: staff.name,
      nickname: staff.nickname || staff.name.split(' ').pop(), // Default to last name
      contactPh: staff.contactPh,
      emergencyContactName: staff.emergencyContactName,
      emergencyContactPh: staff.emergencyContactPh,
      dateOfHire: staff.dateOfHire,
      stats: {
        totalKnowledge: staff.stats.totalKnowledge,
        totalPlayLogs: staff.stats.totalPlayLogs,
        totalContentChecks: staff.stats.totalContentChecks,
      },
    }));

    return NextResponse.json({ staff: directory });
  } catch (error) {
    console.error('Error fetching staff directory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch directory' },
      { status: 500 }
    );
  }
}
