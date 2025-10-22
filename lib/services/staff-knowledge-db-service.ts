import { Pool } from 'pg';

export interface StaffKnowledge {
  id: string;
  staffMemberId: string;
  gameId: string;
  confidenceLevel: number;
  canTeach: boolean;
  taughtBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

class StaffKnowledgeDbService {
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
   * Get all staff knowledge records
   */
  async getAllKnowledge(): Promise<StaffKnowledge[]> {
    try {
      const result = await this.pool.query(`
        SELECT
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at
        FROM staff_knowledge
        ORDER BY staff_member_id, game_id
      `);

      return result.rows.map(this.mapRowToKnowledge);
    } catch (error) {
      console.error('Error fetching all staff knowledge from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get knowledge records for a staff member
   */
  async getKnowledgeByStaffMember(staffMemberId: string): Promise<StaffKnowledge[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at
        FROM staff_knowledge
        WHERE staff_member_id = $1
        ORDER BY confidence_level DESC, game_id`,
        [staffMemberId]
      );

      return result.rows.map(this.mapRowToKnowledge);
    } catch (error) {
      console.error('Error fetching knowledge for staff member:', error);
      throw error;
    }
  }

  /**
   * Get knowledge records for a game
   */
  async getKnowledgeByGame(gameId: string): Promise<StaffKnowledge[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at
        FROM staff_knowledge
        WHERE game_id = $1
        ORDER BY confidence_level DESC, staff_member_id`,
        [gameId]
      );

      return result.rows.map(this.mapRowToKnowledge);
    } catch (error) {
      console.error('Error fetching knowledge for game:', error);
      throw error;
    }
  }

  /**
   * Get knowledge for a specific staff member and game
   */
  async getKnowledge(staffMemberId: string, gameId: string): Promise<StaffKnowledge | null> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at
        FROM staff_knowledge
        WHERE staff_member_id = $1 AND game_id = $2`,
        [staffMemberId, gameId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToKnowledge(result.rows[0]);
    } catch (error) {
      console.error('Error fetching staff knowledge:', error);
      throw error;
    }
  }

  /**
   * Create a new knowledge record
   */
  async createKnowledge(knowledge: Omit<StaffKnowledge, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaffKnowledge> {
    try {
      // Generate unique ID for the knowledge record
      const id = `skn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      const result = await this.pool.query(
        `INSERT INTO staff_knowledge (
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (staff_member_id, game_id) DO UPDATE SET
          confidence_level = $4,
          can_teach = $5,
          taught_by = $6,
          notes = $7,
          updated_at = NOW()
        RETURNING id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at`,
        [
          id,
          knowledge.staffMemberId,
          knowledge.gameId,
          knowledge.confidenceLevel,
          knowledge.canTeach,
          knowledge.taughtBy,
          knowledge.notes,
        ]
      );

      return this.mapRowToKnowledge(result.rows[0]);
    } catch (error) {
      console.error('Error creating staff knowledge in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Update a knowledge record
   */
  async updateKnowledge(
    id: string,
    updates: Partial<Omit<StaffKnowledge, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<StaffKnowledge> {
    try {
      const setClauses = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.staffMemberId !== undefined) {
        setClauses.push(`staff_member_id = $${paramCount++}`);
        values.push(updates.staffMemberId);
      }
      if (updates.gameId !== undefined) {
        setClauses.push(`game_id = $${paramCount++}`);
        values.push(updates.gameId);
      }
      if (updates.confidenceLevel !== undefined) {
        setClauses.push(`confidence_level = $${paramCount++}`);
        values.push(updates.confidenceLevel);
      }
      if (updates.canTeach !== undefined) {
        setClauses.push(`can_teach = $${paramCount++}`);
        values.push(updates.canTeach);
      }
      if (updates.notes !== undefined) {
        setClauses.push(`notes = $${paramCount++}`);
        values.push(updates.notes);
      }

      if (setClauses.length === 0) {
        // No updates, return existing knowledge
        const result = await this.pool.query(
          `SELECT id, staff_member_id, game_id, confidence_level, can_teach, notes,
            created_at, updated_at FROM staff_knowledge WHERE id = $1`,
          [id]
        );
        return this.mapRowToKnowledge(result.rows[0]);
      }

      setClauses.push(`updated_at = NOW()`);
      values.push(id);

      const result = await this.pool.query(
        `UPDATE staff_knowledge SET ${setClauses.join(', ')} WHERE id = $${paramCount}
        RETURNING id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at`,
        values
      );

      return this.mapRowToKnowledge(result.rows[0]);
    } catch (error) {
      console.error('Error updating staff knowledge in PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Delete a knowledge record
   */
  async deleteKnowledge(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM staff_knowledge WHERE id = $1', [id]);
    } catch (error) {
      console.error('Error deleting staff knowledge from PostgreSQL:', error);
      throw error;
    }
  }

  /**
   * Get staff members who can teach a game
   */
  async getTeachersForGame(gameId: string): Promise<StaffKnowledge[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at
        FROM staff_knowledge
        WHERE game_id = $1 AND can_teach = true
        ORDER BY confidence_level DESC`,
        [gameId]
      );

      return result.rows.map(this.mapRowToKnowledge);
    } catch (error) {
      console.error('Error fetching teachers for game:', error);
      throw error;
    }
  }

  /**
   * Get games where staff member can teach
   */
  async getTeachableGamesByStaff(staffMemberId: string): Promise<StaffKnowledge[]> {
    try {
      const result = await this.pool.query(
        `SELECT
          id, staff_member_id, game_id, confidence_level, can_teach, taught_by, notes,
          created_at, updated_at
        FROM staff_knowledge
        WHERE staff_member_id = $1 AND can_teach = true
        ORDER BY confidence_level DESC`,
        [staffMemberId]
      );

      return result.rows.map(this.mapRowToKnowledge);
    } catch (error) {
      console.error('Error fetching teachable games for staff member:', error);
      throw error;
    }
  }

  private mapRowToKnowledge(row: any): StaffKnowledge {
    return {
      id: row.id,
      staffMemberId: row.staff_member_id,
      gameId: row.game_id,
      confidenceLevel: row.confidence_level,
      canTeach: row.can_teach,
      taughtBy: row.taught_by,
      notes: row.notes,
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

export default StaffKnowledgeDbService;
