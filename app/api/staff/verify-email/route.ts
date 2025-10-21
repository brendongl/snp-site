import { NextResponse } from 'next/server';
import { getStaffByEmail } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Query PostgreSQL staff_list table (cached from Airtable StaffList - SNP Games List base)
    const staffListRecord = await getStaffByEmail(email);

    // Check if staff record exists
    if (!staffListRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'This email is not registered as staff. Please contact an administrator.'
        },
        { status: 401 }
      );
    }

    // staffListRecord contains both Staff ID and StaffList ID from PostgreSQL cache
    // Play Logs "Logged By" field links to StaffList (same base), so we MUST use staffListId
    return NextResponse.json(
      {
        success: true,
        staffId: staffListRecord.id, // Sip N Play Staff table ID (for reference)
        staffListRecordId: staffListRecord.staffListId, // SNP Games List StaffList ID (REQUIRED for Play Logs linking)
        staffName: staffListRecord.name,
        email,
        type: staffListRecord.type,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying staff email:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify email';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
