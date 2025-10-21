import { Pool } from 'pg';

export interface ContentCheck {
  id: string;
  gameId: string;
  inspectorId: string;
  checkDate: string | null;
  status: string[];
  missingPieces: boolean;
  boxCondition: string | null;
  cardCondition: string | null;
  isFake: boolean;
  notes: string | null;
  sleeved: boolean;
  boxWrapped: boolean;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

class ContentChecksDbService {
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
   * Get all content checks
   */
  async getAllChecks(): Promise<ContentCheck[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        FROM content_checks
        ORDER BY check_date DESC
      `);

      return result.rows.map(this.mapRowToCheck);
    } catch (error) {
      console.error('Error fetching all content checks from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get content checks for a specific game
   */
  async getChecksByGameId(gameId: string): Promise<ContentCheck[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        FROM content_checks
        WHERE game_id = $1
        ORDER BY check_date DESC`,
        [gameId]
      );

      return result.rows.map(this.mapRowToCheck);
    } catch (error) {
      console.error('Error fetching content checks for game:', error);
      throw error;
    }
  }

  /**
   * Get content checks by inspector
   */
  async getChecksByInspector(inspectorId: string): Promise<ContentCheck[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        FROM content_checks
        WHERE inspector_id = $1
        ORDER BY check_date DESC`,
        [inspectorId]
      );

      return result.rows.map(this.mapRowToCheck);
    } catch (error) {
      console.error('Error fetching content checks for inspector:', error);
      throw error;
    }
  }

  /**
   * Get latest check for a game
   */
  async getLatestCheckForGame(gameId: string): Promise<ContentCheck | null> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        FROM content_checks
        WHERE game_id = $1
        ORDER BY check_date DESC
        LIMIT 1`,
        [gameId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCheck(result.rows[0]);
    } catch (error) {
      console.error('Error fetching latest content check for game:', error);
      throw error;
    }
  }

  /**
   * Create a new content check
   */
  async createCheck(check: Omit<ContentCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentCheck> {
    try {
      const result = await this.pool.query(
        `INSERT INTO content_checks (
          game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        RETURNING id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at`,
        [
          check.gameId,
          check.inspectorId,
          check.checkDate,
          JSON.stringify(check.status),
          check.missingPieces,
          check.boxCondition,
          check.cardCondition,
          check.isFake,
          check.notes,
          check.sleeved,
          check.boxWrapped,
          JSON.stringify(check.photos),
        ]
      );

      return this.mapRowToCheck(result.rows[0]);
    } catch (error) {
      console.error('Error creating content check in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Update a content check
   */
  async updateCheck(id: string, updates: Partial<Omit<ContentCheck, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ContentCheck> {
    try {
      const setClauses = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.gameId !== undefined) {
        setClauses.push(`game_id = $${paramCount++}`);
        values.push(updates.gameId);
      }
      if (updates.inspectorId !== undefined) {
        setClauses.push(`inspector_id = $${paramCount++}`);
        values.push(updates.inspectorId);
      }
      if (updates.checkDate !== undefined) {
        setClauses.push(`check_date = $${paramCount++}`);
        values.push(updates.checkDate);
      }
      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramCount++}`);
        values.push(JSON.stringify(updates.status));
      }
      if (updates.missingPieces !== undefined) {
        setClauses.push(`missing_pieces = $${paramCount++}`);
        values.push(updates.missingPieces);
      }
      if (updates.boxCondition !== undefined) {
        setClauses.push(`box_condition = $${paramCount++}`);
        values.push(updates.boxCondition);
      }
      if (updates.cardCondition !== undefined) {
        setClauses.push(`card_condition = $${paramCount++}`);
        values.push(updates.cardCondition);
      }
      if (updates.isFake !== undefined) {
        setClauses.push(`is_fake = $${paramCount++}`);
        values.push(updates.isFake);
      }
      if (updates.notes !== undefined) {
        setClauses.push(`notes = $${paramCount++}`);
        values.push(updates.notes);
      }
      if (updates.sleeved !== undefined) {
        setClauses.push(`sleeved_at_check = $${paramCount++}`);
        values.push(updates.sleeved);
      }
      if (updates.boxWrapped !== undefined) {
        setClauses.push(`box_wrapped_at_check = $${paramCount++}`);
        values.push(updates.boxWrapped);
      }
      if (updates.photos !== undefined) {
        setClauses.push(`photos = $${paramCount++}`);
        values.push(JSON.stringify(updates.photos));
      }

      if (setClauses.length === 0) {
        // No updates, return existing check
        const result = await this.pool.query(
          `SELECT id, game_id, inspector_id, check_date, status, missing_pieces,
            box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
            photos, created_at, updated_at FROM content_checks WHERE id = $1`,
          [id]
        );
        return this.mapRowToCheck(result.rows[0]);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.pool.query(
        `UPDATE content_checks SET ${setClauses.join(', ')} WHERE id = $${paramCount}
        RETURNING id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at`,
        values
      );

      return this.mapRowToCheck(result.rows[0]);
    } catch (error) {
      console.error('Error updating content check in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Delete a content check
   */
  async deleteCheck(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM content_checks WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting content check from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get checks created in date range
   */
  async getChecksByDateRange(startDate: string, endDate: string): Promise<ContentCheck[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, game_id, inspector_id, check_date, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        FROM content_checks
        WHERE check_date >= $1 AND check_date <= $2
        ORDER BY check_date DESC`,
        [startDate, endDate]
      );

      return result.rows.map(this.mapRowToCheck);
    } catch (error) {
      console.error('Error fetching content checks by date range:', error);
      throw error;
    }
  }

  private mapRowToCheck(row: any): ContentCheck {
    return {
      id: row.id,
      gameId: row.game_id,
      inspectorId: row.inspector_id,
      checkDate: row.check_date,
      status: JSON.parse(row.status || '[]'),
      missingPieces: row.missing_pieces,
      boxCondition: row.box_condition,
      cardCondition: row.card_condition,
      isFake: row.is_fake,
      notes: row.notes,
      sleeved: row.sleeved_at_check,
      boxWrapped: row.box_wrapped_at_check,
      photos: JSON.parse(row.photos || '[]'),
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

export default ContentChecksDbService;
