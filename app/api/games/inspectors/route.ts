import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getStaffList } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    logger.info('Inspectors', 'Fetching inspectors from PostgreSQL staff_list');

    // Fetch staff from PostgreSQL
    const staff = await getStaffList();

    // Map to inspectors format (id = stafflist_id, name = staff_name)
    const inspectors = staff.map(member => ({
      id: member.id, // stafflist_id from PostgreSQL
      name: member.name, // staff_name from PostgreSQL
    }));

    logger.info('Inspectors', `Fetched ${inspectors.length} inspectors from PostgreSQL`);

    return NextResponse.json({
      inspectors,
    });
  } catch (error) {
    logger.error('Inspectors', 'Error fetching inspectors', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Failed to fetch inspectors' },
      { status: 500 }
    );
  }
}
