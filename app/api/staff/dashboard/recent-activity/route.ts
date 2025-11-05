import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch recent activity from changelog with staff names (v1.5.9: added points and nickname)
    const result = await pool.query(
      `
      SELECT
        c.category as type,
        c.created_at as timestamp,
        COALESCE(s.staff_name, c.staff_member) as staff_name,
        s.nickname as nickname,
        s.staff_name as full_name,
        c.description,
        c.event_type,
        c.metadata,
        COALESCE(c.points_awarded, 0) as points_earned
      FROM changelog c
      LEFT JOIN staff_list s ON c.staff_id = s.id
      ORDER BY c.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    // Format activities to match dashboard display format
    const activities = result.rows.map((row) => {
      let game_name = 'Unknown Game';
      let action = '';
      let status_info = '';

      // Extract game name and format action based on category
      if (row.type === 'content_check') {
        // Format: "Content check: TIME BOMB (JAPANESE) - Minor Issues"
        const match = row.description.match(/Content check:\s*(.+?)\s*-\s*(.+)/);
        if (match) {
          game_name = match[1].trim();
          status_info = match[2].trim();
          action = `checked ${game_name} - Has ${status_info}`;
        } else {
          action = 'checked a game';
        }
      } else if (row.type === 'play_log') {
        // Format: "Logged play session for GAME NAME"
        const match = row.description.match(/Logged play session for\s*(.+)/);
        if (match) {
          game_name = match[1].trim();
          action = `logged play for ${game_name}`;
        } else {
          action = 'logged play';
        }
      } else if (row.type === 'staff_knowledge') {
        const metadata = row.metadata || {};
        const level = metadata.confidenceLevel || 'Unknown';

        // Check for bulk creation (but only show as bulk if count > 1)
        if (metadata.isBulk && (metadata.gameCount || 1) > 1) {
          const count = metadata.gameCount;
          game_name = `${count} games`;
          action = `marked knowledge for ${game_name} as ${level}`;
        } else {
          // Single game: "Added knowledge: GAME NAME - LEVEL level"
          const match = row.description.match(/Added knowledge:\s*(.+?)\s*-\s*(.+?)\s*level/);
          if (match) {
            game_name = match[1].trim();
            action = `marked knowledge for ${game_name} as ${level}`;
          } else {
            action = `marked knowledge as ${level}`;
          }
        }
      } else if (row.type === 'board_game') {
        if (row.event_type === 'photo_added') {
          const match = row.description.match(/Added \d+ photos? to\s*(.+)/);
          if (match) {
            game_name = match[1].trim();
            action = `added photo to ${game_name}`;
          }
        } else if (row.event_type === 'updated') {
          const match = row.description.match(/Updated game:\s*(.+)/);
          if (match) {
            game_name = match[1].trim();
            action = `updated ${game_name}`;
          }
        } else if (row.event_type === 'created') {
          const metadata = row.metadata || {};
          game_name = metadata.name || 'a game';
          action = `added game ${game_name}`;
        }
      } else if (row.type === 'task') {
        // Handle task category (task completions from Vikunja)
        const taskMatch = row.description.match(/Completed task:\s*(.+)/);
        if (taskMatch) {
          game_name = taskMatch[1].trim();
          action = `completed task: ${game_name}`;
        } else {
          action = row.description.toLowerCase();
        }
      } else if (row.type === 'issue_report') {
        // Handle issue reports
        const issueMatch = row.description.match(/Reported\s+(.+?)\s+issue for game\s+(.+)/);
        if (issueMatch) {
          const issueType = issueMatch[1].trim();
          game_name = issueMatch[2].trim();
          action = `reported ${issueType} issue for ${game_name}`;
        } else {
          action = row.description.toLowerCase();
        }
      } else if (row.type === 'points') {
        // Handle generic points category (legacy)
        action = row.description.toLowerCase();
      }

      return {
        type: row.type,
        timestamp: row.timestamp,
        staff_name: row.staff_name || 'Unknown',
        nickname: row.nickname,
        full_name: row.full_name,
        game_name,
        action,
        description: row.description,
        points_earned: row.points_earned,
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
