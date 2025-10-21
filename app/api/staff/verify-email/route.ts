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

    // Now fetch the Sip N Play Staff table record ID from Airtable
    // (StaffList is a synced table, but we need the original Staff record ID for consistency)
    const apiKey = process.env.AIRTABLE_API_KEY;
    const sipNPlayBaseId = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
    const staffTableId = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblLthDOTzCPbSdAA';

    let staffId = staffListRecord.id; // Default to StaffList ID as fallback

    if (apiKey) {
      try {
        const staffResponse = await fetch(
          `https://api.airtable.com/v0/${sipNPlayBaseId}/${staffTableId}?filterByFormula={Email}="${encodeURIComponent(email)}"`,
          {
            headers: { Authorization: `Bearer ${apiKey}` },
          }
        );

        if (staffResponse.ok) {
          const staffData = await staffResponse.json();
          if (staffData.records && staffData.records.length > 0) {
            staffId = staffData.records[0].id; // Get the actual Sip N Play Staff table record ID
          }
        }
      } catch (airtableError) {
        console.warn('Could not fetch Sip N Play Staff record ID from Airtable:', airtableError);
        // Fall through - staffId will remain as StaffList ID
      }
    }

    // staffListRecord.id is the StaffList record ID from SNP Games List base
    // staffId is the Staff record ID from Sip N Play base (or StaffList ID as fallback)
    return NextResponse.json(
      {
        success: true,
        staffId, // Sip N Play Staff table record ID (for reference)
        staffListRecordId: staffListRecord.id, // SNP Games List StaffList table record ID (for Play Logs linking)
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
