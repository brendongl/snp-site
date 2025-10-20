import { NextResponse } from 'next/server';
import { syncStaffListFromAirtable } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_GAMES_BASE_ID = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';
const AIRTABLE_STAFF_TABLE_ID = process.env.AIRTABLE_STAFF_TABLE_ID || 'tblGIyQNmhcsK4Qlg';

export async function POST(request: Request) {
  try {
    if (!AIRTABLE_API_KEY) {
      return NextResponse.json(
        { error: 'Airtable API key not configured' },
        { status: 500 }
      );
    }

    console.log('Starting staff list sync from Airtable...');

    // Fetch all staff from Airtable Staff table
    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_GAMES_BASE_ID}/${AIRTABLE_STAFF_TABLE_ID}`,
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

    // Transform Airtable records to our format
    const staff = (data.records || []).map((record: any) => {
      const name = record.fields['Name'] || 'Unknown';

      return {
        id: record.id,
        name,
      };
    });

    console.log(`Fetched ${staff.length} staff members from Airtable`);

    // Sync to PostgreSQL
    const success = await syncStaffListFromAirtable(staff);

    if (!success) {
      throw new Error('Failed to sync staff list to database');
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${staff.length} staff members`,
      count: staff.length,
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
