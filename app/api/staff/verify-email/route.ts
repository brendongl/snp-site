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

    // Query PostgreSQL staff_list table (cached from Airtable)
    const staffRecord = await getStaffByEmail(email);

    // Check if staff record exists
    if (!staffRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'This email is not registered as staff. Please contact an administrator.'
        },
        { status: 401 }
      );
    }

    // staffRecord.id is already the StaffList record ID from PostgreSQL
    // (since staff_list table is synced from Airtable StaffList)
    return NextResponse.json(
      {
        success: true,
        staffId: staffRecord.id,
        staffListRecordId: staffRecord.id,
        staffName: staffRecord.name,
        email,
        type: staffRecord.type,
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
