import { NextResponse } from 'next/server';
import { getStaffList } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Fetch staff list from PostgreSQL cache
    const staff = await getStaffList();

    return NextResponse.json({
      staff,
      count: staff.length,
    });
  } catch (error) {
    console.error('Error fetching staff list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch staff list';

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
