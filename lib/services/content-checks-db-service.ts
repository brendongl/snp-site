import { Pool } from 'pg';

export interface ContentCheck {
  id: string;
  gameId: string;
  inspectorId: string;
  checkDate: string | null;
  checkType?: string; // 'regular' or 'piece_recovery'
  status: string[];
  missingPieces: string | null; // TEXT field in database
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
      // Check if check_type column exists first (for backwards compatibility)
      const columnsResult = await this.pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'content_checks' AND column_name = 'check_type'
      `);
      const hasCheckType = columnsResult.rows.length > 0;

      const selectClause = hasCheckType
        ? `id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
           box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
           photos, created_at, updated_at`
        : `id, game_id, inspector_id, check_date, status, missing_pieces,
           box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
           photos, created_at, updated_at`;

      const result = await this.pool.query(`
        SELECT ${selectClause}
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
   * Get content checks for a specific game (with staff names)
   */
  async getChecksByGameId(gameId: string): Promise<any[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          cc.id,
          cc.game_id,
          cc.inspector_id,
          sl.staff_name AS inspector_name,
          cc.check_date,
          cc.check_type,
          cc.status,
          cc.missing_pieces,
          cc.box_condition,
          cc.card_condition,
          cc.is_fake,
          cc.notes,
          cc.sleeved_at_check,
          cc.box_wrapped_at_check,
          cc.photos,
          cc.created_at,
          cc.updated_at
        FROM content_checks cc
        LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
        WHERE cc.game_id = $1
        ORDER BY cc.check_date DESC, cc.created_at DESC`,
        [gameId]
      );

      return result.rows.map((row: any) => ({
        ...this.mapRowToCheck(row),
        inspectorName: row.inspector_name || 'Unknown Staff',
      }));
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
          id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
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
          id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
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
      // Generate a unique ID
      const id = `cck_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      // Status is stored as VARCHAR - use first element of array or empty string
      const statusValue = Array.isArray(check.status) && check.status.length > 0
        ? check.status[0]
        : '';

      // Photos is stored as TEXT[] - pass array directly (node-postgres handles it)
      const photosValue = Array.isArray(check.photos) ? check.photos : [];

      const result = await this.pool.query(
        `INSERT INTO content_checks (
          id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING id, game_id, inspector_id, check_date, check_type, status, missing_pieces,
          box_condition, card_condition, is_fake, notes, sleeved_at_check, box_wrapped_at_check,
          photos, created_at, updated_at`,
        [
          id,
          check.gameId,
          check.inspectorId,
          check.checkDate,
          check.checkType || 'regular',
          statusValue,
          check.missingPieces,
          check.boxCondition,
          check.cardCondition,
          check.isFake,
          check.notes,
          check.sleeved,
          check.boxWrapped,
          photosValue,
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
        // Status is VARCHAR - store first element of array
        const statusValue = Array.isArray(updates.status) && updates.status.length > 0
          ? updates.status[0]
          : '';
        values.push(statusValue);
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
        // Photos is TEXT[] - pass array directly
        const photosValue = Array.isArray(updates.photos) ? updates.photos : [];
        values.push(photosValue);
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

  /**
   * Get all checks with game names (via JOIN)
   */
  async getAllChecksWithGameNames(): Promise<any[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          cc.id,
          cc.game_id,
          g.name AS game_name,
          cc.check_date,
          cc.inspector_id,
          sl.staff_name AS inspector_name,
          cc.status,
          cc.notes,
          cc.box_condition,
          cc.card_condition,
          cc.missing_pieces,
          cc.sleeved_at_check,
          cc.box_wrapped_at_check,
          cc.is_fake
        FROM content_checks cc
        LEFT JOIN games g ON cc.game_id = g.id
        LEFT JOIN staff_list sl ON cc.inspector_id = sl.stafflist_id
        ORDER BY cc.check_date DESC
      `);

      return result.rows.map((row: any) => {
        // Status is stored as VARCHAR (plain string), not JSON
        const statusString = row.status || 'Unknown';

        return {
          id: row.id,
          gameId: row.game_id,
          gameName: row.game_name || 'Unknown Game',
          checkDate: row.check_date,
          inspector: row.inspector_name || 'Unknown Staff',
          status: statusString,
          notes: row.notes || '',
          boxCondition: row.box_condition,
          cardCondition: row.card_condition,
          missingPieces: row.missing_pieces,
          sleeved: row.sleeved_at_check,
          boxWrapped: row.box_wrapped_at_check,
          isFake: row.is_fake,
        };
      });
    } catch (error) {
      console.error('Error fetching content checks with game names:', error);
      throw error;
    }
  }

  private mapRowToCheck(row: any): ContentCheck {
    // Helper function to safely parse status field
    // Handles both plain string (legacy) and JSON array (new format)
    const parseStatus = (statusValue: any): string[] => {
      if (!statusValue) return [];
      if (Array.isArray(statusValue)) return statusValue;
      if (typeof statusValue === 'string') {
        // Try to parse as JSON first
        try {
          const parsed = JSON.parse(statusValue);
          return Array.isArray(parsed) ? parsed : [statusValue];
        } catch {
          // If not JSON, treat as plain string
          return [statusValue];
        }
      }
      return [];
    };

    // Helper function to safely parse photos field
    // Handles null, array, and JSON string
    const parsePhotos = (photosValue: any): string[] => {
      if (!photosValue) return [];
      if (Array.isArray(photosValue)) return photosValue;
      if (typeof photosValue === 'string') {
        try {
          const parsed = JSON.parse(photosValue);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    return {
      id: row.id,
      gameId: row.game_id,
      inspectorId: row.inspector_id,
      checkDate: row.check_date,
      checkType: row.check_type || 'regular',
      status: parseStatus(row.status),
      missingPieces: row.missing_pieces || null, // TEXT field, not boolean
      boxCondition: row.box_condition,
      cardCondition: row.card_condition,
      isFake: row.is_fake || false,
      notes: row.notes,
      sleeved: row.sleeved_at_check || false,
      boxWrapped: row.box_wrapped_at_check || false,
      photos: parsePhotos(row.photos),
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
