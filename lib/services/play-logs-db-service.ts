import { Pool } from 'pg';

export interface PlayLog {
  id: string;
  gameId: string;
  staffListId: string;
  sessionDate: string | null;
  notes: string | null;
  durationHours: number | null;
  createdAt: string;
  updatedAt: string;
}

class PlayLogsDbService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      // Connection pool configuration for Railway production environment
      max: 10, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection can't be acquired
    });
  }

  /**
   * Get all play logs
   */
  async getAllLogs(): Promise<PlayLog[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at
        FROM play_logs
        ORDER BY session_date DESC, created_at DESC
      `);

      return result.rows.map(this.mapRowToPlayLog);
    } catch (error) {
      console.error('Error fetching all play logs from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get play logs for a specific game
   */
  async getLogsByGameId(gameId: string): Promise<PlayLog[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at
        FROM play_logs
        WHERE game_id = $1
        ORDER BY session_date DESC, created_at DESC`,
        [gameId]
      );

      return result.rows.map(this.mapRowToPlayLog);
    } catch (error) {
      console.error('Error fetching play logs for game:', error);
      throw error;
    }
  }

  /**
   * Get play logs by staff member
   */
  async getLogsByStaffMember(staffListId: string): Promise<PlayLog[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at
        FROM play_logs
        WHERE staff_list_id = $1
        ORDER BY session_date DESC, created_at DESC`,
        [staffListId]
      );

      return result.rows.map(this.mapRowToPlayLog);
    } catch (error) {
      console.error('Error fetching play logs for staff member:', error);
      throw error;
    }
  }

  /**
   * Get a specific play log by ID
   */
  async getLogById(id: string): Promise<PlayLog | null> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at
        FROM play_logs
        WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPlayLog(result.rows[0]);
    } catch (error) {
      console.error('Error fetching play log by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new play log
   */
  async createLog(log: Omit<PlayLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlayLog> {
    try {
      const result = await this.pool.query(
        `INSERT INTO play_logs (
          game_id, staff_list_id, session_date, notes, duration_hours, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at`,
        [
          log.gameId,
          log.staffListId,
          log.sessionDate,
          log.notes,
          log.durationHours,
        ]
      );

      return this.mapRowToPlayLog(result.rows[0]);
    } catch (error) {
      console.error('Error creating play log in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Update a play log
   */
  async updateLog(id: string, updates: Partial<Omit<PlayLog, 'id' | 'createdAt' | 'updatedAt'>>): Promise<PlayLog> {
    try {
      const setClauses = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.gameId !== undefined) {
        setClauses.push(`game_id = $${paramCount++}`);
        values.push(updates.gameId);
      }
      if (updates.staffListId !== undefined) {
        setClauses.push(`staff_list_id = $${paramCount++}`);
        values.push(updates.staffListId);
      }
      if (updates.sessionDate !== undefined) {
        setClauses.push(`session_date = $${paramCount++}`);
        values.push(updates.sessionDate);
      }
      if (updates.notes !== undefined) {
        setClauses.push(`notes = $${paramCount++}`);
        values.push(updates.notes);
      }
      if (updates.durationHours !== undefined) {
        setClauses.push(`duration_hours = $${paramCount++}`);
        values.push(updates.durationHours);
      }

      if (setClauses.length === 0) {
        // No updates, return existing log
        const result = await this.pool.query(
          `SELECT id, game_id, staff_list_id, session_date, notes, duration_hours,
            created_at, updated_at FROM play_logs WHERE id = $1`,
          [id]
        );
        return this.mapRowToPlayLog(result.rows[0]);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.pool.query(
        `UPDATE play_logs SET ${setClauses.join(', ')} WHERE id = $${paramCount}
        RETURNING id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at`,
        values
      );

      return this.mapRowToPlayLog(result.rows[0]);
    } catch (error) {
      console.error('Error updating play log in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Delete a play log
   */
  async deleteLog(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM play_logs WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting play log from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get play logs created in date range
   */
  async getLogsByDateRange(startDate: string, endDate: string): Promise<PlayLog[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, staff_list_id, session_date, notes, duration_hours,
          created_at, updated_at
        FROM play_logs
        WHERE session_date >= $1 AND session_date <= $2
        ORDER BY session_date DESC`,
        [startDate, endDate]
      );

      return result.rows.map(this.mapRowToPlayLog);
    } catch (error) {
      console.error('Error fetching play logs by date range:', error);
      throw error;
    }
  }

  /**
   * Get total play time for a game
   */
  async getTotalPlayTimeForGame(gameId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `SELECT COALESCE(SUM(duration_hours), 0) as total_hours
        FROM play_logs
        WHERE game_id = $1`,
        [gameId]
      );

      return result.rows[0].total_hours || 0;
    } catch (error) {
      console.error('Error fetching total play time for game:', error);
      throw error;
    }
  }

  /**
   * Get total play time for a staff member
   */
  async getTotalPlayTimeForStaff(staffListId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `SELECT COALESCE(SUM(duration_hours), 0) as total_hours
        FROM play_logs
        WHERE staff_list_id = $1`,
        [staffListId]
      );

      return result.rows[0].total_hours || 0;
    } catch (error) {
      console.error('Error fetching total play time for staff member:', error);
      throw error;
    }
  }

  private mapRowToPlayLog(row: any): PlayLog {
    return {
      id: row.id,
      gameId: row.game_id,
      staffListId: row.staff_list_id,
      sessionDate: row.session_date,
      notes: row.notes,
      durationHours: row.duration_hours,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default PlayLogsDbService;
