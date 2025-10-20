'use server';

import { Pool } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mkzYUwOIMzDrOMFTLeRUlxLXtQsIQmST@shuttle.proxy.rlwy.net:38585/railway',
});

// Initialize pool error handler
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Check if a game was logged recently (within the last hour)
 * Returns the staff name and time ago if found, null otherwise
 */
export async function checkRecentPlayLog(gameId: string): Promise<{
  staffName: string;
  loggedAtISO: string;
  minutesAgo: number;
} | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT staff_name, logged_at,
              EXTRACT(EPOCH FROM (NOW() - logged_at))::INTEGER as seconds_ago
       FROM play_log_cache
       WHERE game_id = $1
       AND logged_at > NOW() - INTERVAL '1 hour'
       ORDER BY logged_at DESC
       LIMIT 1`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const minutesAgo = Math.ceil(row.seconds_ago / 60);

    return {
      staffName: row.staff_name,
      loggedAtISO: row.logged_at,
      minutesAgo,
    };
  } finally {
    client.release();
  }
}

/**
 * Cache a new play log entry
 */
export async function cachePlayLog(
  gameId: string,
  staffName: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO play_log_cache (game_id, staff_name, logged_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (game_id) DO UPDATE
       SET staff_name = $2, logged_at = NOW()`,
      [gameId, staffName]
    );

    return true;
  } catch (error) {
    console.error('Error caching play log:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Clean up old play log entries (older than 1 hour)
 * This should be called periodically (via cron job or manual trigger)
 */
export async function cleanupOldPlayLogs(): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM play_log_cache
       WHERE logged_at < NOW() - INTERVAL '1 hour'`
    );

    console.log(`Cleaned up ${result.rowCount} old play log entries`);
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Get all recent play logs (for debugging/monitoring)
 */
export async function getRecentPlayLogs(
  limitMinutes: number = 60
): Promise<Array<{ gameId: string; staffName: string; loggedAt: string }>> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT game_id, staff_name, logged_at
       FROM play_log_cache
       WHERE logged_at > NOW() - INTERVAL '${limitMinutes} minutes'
       ORDER BY logged_at DESC`
    );

    return result.rows.map((row) => ({
      gameId: row.game_id,
      staffName: row.staff_name,
      loggedAt: row.logged_at,
    }));
  } finally {
    client.release();
  }
}

/**
 * Get all staff members from cache
 */
export async function getStaffList(): Promise<Array<{ id: string; name: string; type: string }>> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT staff_id, staff_name, staff_type FROM staff_list ORDER BY staff_name ASC`
    );

    return result.rows.map(row => ({
      id: row.staff_id,
      name: row.staff_name,
      type: row.staff_type || 'Staff',
    }));
  } finally {
    client.release();
  }
}

/**
 * Get staff member by email
 */
export async function getStaffByEmail(email: string): Promise<{ id: string; name: string; type: string } | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT staff_id, staff_name, staff_type FROM staff_list WHERE staff_email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.staff_id,
      name: row.staff_name,
      type: row.staff_type || 'Staff',
    };
  } finally {
    client.release();
  }
}

/**
 * Sync staff list from Airtable to cache
 */
export async function syncStaffListFromAirtable(staffData: Array<{ id: string; name: string; email: string; type: string }>): Promise<boolean> {
  const client = await pool.connect();
  try {
    // Clear existing data
    await client.query('DELETE FROM staff_list');

    // Insert new data
    for (const staff of staffData) {
      await client.query(
        `INSERT INTO staff_list (staff_id, staff_name, staff_email, staff_type) VALUES ($1, $2, $3, $4)`,
        [staff.id, staff.name, staff.email, staff.type]
      );
    }

    console.log(`Synced ${staffData.length} staff members to database`);
    return true;
  } catch (error) {
    console.error('Error syncing staff list:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Close all connections in the pool
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
