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

    console.log('Starting staff list sync from Airtable...');

    // Fetch staff from Sip N Play Staff table
    console.log('📋 Fetching from Sip N Play Staff table...');
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

    // Map to simple staff data structure
    const staffToSync = staffData.records
      .filter((record: any) => record.fields['Email']) // Only sync staff with emails
      .map((record: any) => ({
        name: record.fields['Name'] || 'Unknown',
        email: record.fields['Email'],
        type: record.fields['Type'] || 'Staff',
      }));

    console.log(`\n✅ Prepared ${staffToSync.length} staff records for sync`);

    if (staffToSync.length === 0) {
      throw new Error('No staff records with emails found');
    }

    // Sync to PostgreSQL (UUIDs will be generated automatically or preserved if existing)
    const success = await syncStaffListFromAirtable(staffToSync);

    if (!success) {
      throw new Error('Failed to sync staff list to database');
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${staffToSync.length} staff members to PostgreSQL`,
      count: staffToSync.length,
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
