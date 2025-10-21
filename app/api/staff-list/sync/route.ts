import { NextResponse } from 'next/server';
import { syncStaffListFromAirtable } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_SIP_N_PLAY_BASE_ID = process.env.AIRTABLE_SIP_N_PLAY_BASE_ID || 'appjD3LJhXYjp0tXm';
const AIRTABLE_GAMES_BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblLthDOTzCPbSdAA';  // Sip N Play Staff table
const AIRTABLE_STAFFLIST_TABLE_ID = 'tblGIyQNmhcsK4Qlg';  // SNP Games List StaffList table

export async function POST(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    console.log('Starting dual-table staff list sync from Airtable...');

    // Step 1: Fetch all staff from Sip N Play Staff table (original source with emails)
    console.log('📋 Fetching from Sip N Play Staff table (original source)...');
    const staffResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_SIP_N_PLAY_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!staffResponse.ok) {
      throw new Error(`Failed to fetch Staff table: ${staffResponse.statusText}`);
    }

    const staffData = await staffResponse.json();
    console.log(`✓ Fetched ${staffData.records.length} records from Staff table`);

    // Step 2: Fetch all staff from SNP Games List StaffList table (for Play Logs linking IDs)
    console.log('📋 Fetching from SNP Games List StaffList table (synced copy)...');
    const staffListResponse = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_STAFFLIST_TABLE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        },
      }
    );

    if (!staffListResponse.ok) {
      throw new Error(`Failed to fetch StaffList table: ${staffListResponse.statusText}`);
    }

    const staffListData = await staffListResponse.json();
    console.log(`✓ Fetched ${staffListData.records.length} records from StaffList table`);

    // Step 3: Create map of email → Staff data (Sip N Play Staff)
    console.log('🔗 Correlating records by email...');
    const staffMap = new Map<string, any>();

    staffData.records.forEach((record: any) => {
      const email = record.fields['Email'];
      const name = record.fields['Name'] || 'Unknown';

      if (email) {
        const emailLower = email.toLowerCase();
        staffMap.set(emailLower, {
          staffId: record.id,  // Sip N Play Staff ID
          name,
          email,
          type: record.fields['Type'] || 'Staff',
          staffListId: null,   // Will be populated from StaffList query
        });
      }
    });

    // Step 4: Match StaffList IDs by email and populate the map
    staffListData.records.forEach((record: any) => {
      const email = record.fields['Email'];
      if (email) {
        const emailLower = email.toLowerCase();
        if (staffMap.has(emailLower)) {
          const staffRecord = staffMap.get(emailLower);
          staffRecord.staffListId = record.id;  // SNP Games List StaffList ID
          console.log(`   ✓ ${staffRecord.name}: Staff=${staffRecord.staffId} StaffList=${staffRecord.staffListId}`);
        }
      }
    });

    // Step 5: Filter to only records with both IDs
    const completeStaff = Array.from(staffMap.values()).filter(
      (s: any) => s.staffId && s.staffListId && s.email
    );

    console.log(`\n✅ Correlated ${completeStaff.length} staff records with both IDs`);

    if (completeStaff.length === 0) {
      throw new Error('No staff records could be correlated between Staff and StaffList tables');
    }

    // Step 6: Sync to PostgreSQL
    const success = await syncStaffListFromAirtable(completeStaff);

    if (!success) {
      throw new Error('Failed to sync staff list to database');
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${completeStaff.length} staff members with both Staff and StaffList IDs`,
      count: completeStaff.length,
      staffCount: staffData.records.length,
      staffListCount: staffListData.records.length,
    });
  } catch (error) {
    console.error('Error syncing staff list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sync staff list';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
