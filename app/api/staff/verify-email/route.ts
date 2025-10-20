import { NextResponse } from 'next/server';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_SIP_N_PLAY_BASE_ID = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblLthDOTzCPbSdAA';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Query Airtable Staff table for this email
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_SIP_N_PLAY_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}?filterByFormula={Email}='${encodeURIComponent(email)}'`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if staff record exists
    if (!data.records || data.records.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'This email is not registered as staff. Please contact an administrator.'
        },
        { status: 401 }
      );
    }

    // Return the first matching staff record
    const staffRecord = data.records[0];
    const staffId = staffRecord.id;
    const staffName = staffRecord.fields['Name'] || 'Staff Member';
    const staffType = staffRecord.fields['Type'] || 'Staff';

    return NextResponse.json(
      {
        success: true,
        staffId,
        staffName,
        email,
        type: staffType,
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
