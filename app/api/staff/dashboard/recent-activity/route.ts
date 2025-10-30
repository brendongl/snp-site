import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch recent activity directly from changelog table (EXACT match to /staff/changelog)
    const result = await pool.query(
      `
      SELECT
        category as type,
        created_at as timestamp,
        staff_member as staff_name,
        description,
        event_type,
        metadata
      FROM changelog
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    // Format activities to match dashboard display format
    const activities = result.rows.map((row) => {
      // Extract game name from description if available
      // Metadata may contain game_name field
      let game_name = 'Unknown Game';
      try {
        if (row.metadata) {
          const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          game_name = metadata.game_name || metadata.gameName || 'Unknown Game';
        }
      } catch (e) {
        // Fallback: try to extract from description
        const match = row.description.match(/(?:for|to|:)\s+([^-(\n]+)/);
        if (match) {
          game_name = match[1].trim();
        }
      }

      // Generate action text based on category and event type
      let action = row.description;
      if (row.event_type === 'created') {
        if (row.type === 'staff_knowledge') action = 'created staff knowledge';
        else if (row.type === 'play_log') action = 'logged play';
        else if (row.type === 'content_check') action = 'checked';
        else if (row.type === 'board_game') action = 'added game';
      } else if (row.event_type === 'updated') {
        action = 'updated';
      } else if (row.event_type === 'deleted') {
        action = 'deleted';
      }

      return {
        type: row.type,
        timestamp: row.timestamp,
        staff_name: row.staff_name || 'Unknown',
        game_name,
        action,
        description: row.description,
      };
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch recent activity',
        details: errorMessage,
        hint: 'Check database tables and columns'
      },
      { status: 500 }
    );
  }
}
