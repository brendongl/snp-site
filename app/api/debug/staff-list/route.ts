import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const client = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('DEBUG: Querying PostgreSQL staff_list table...');

    const result = await client.query(`
      SELECT id, staff_name, staff_email, staff_type, created_at
      FROM staff_list
      ORDER BY staff_name ASC
    `);

    console.log(`DEBUG: Retrieved ${result.rows.length} staff members from database`);

    // Log each row to debug
    result.rows.forEach(row => {
      console.log(`DEBUG: ${row.staff_name}: id=${row.id}, email=${row.staff_email}`);
    });

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      staff: result.rows.map(row => ({
        name: row.staff_name,
        email: row.staff_email,
        id: row.id,
        type: row.staff_type,
        createdAt: row.created_at,
      })),
      columns: ['name', 'email', 'id', 'type', 'createdAt'],
    });
  } catch (error) {
    console.error('Error querying staff_list table:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to query staff_list';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : null,
      },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}
