import { Pool } from 'pg';

export interface StaffMember {
  staffId: string;
  stafflistId: string;
  name: string;
  nickname: string | null;
  email: string;
  type: string;
  contactPh: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  nationalIdHash: string | null;
  homeAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPh: string | null;
  dateOfHire: string | null;
  createdAt: string;
  updatedAt: string;
  profileUpdatedAt: string | null;
}

export interface StaffProfileUpdate {
  nickname?: string;
  email?: string;
  contactPh?: string;
  bankAccountNumber?: string;
  bankName?: string;
  homeAddress?: string;
  emergencyContactName?: string;
  emergencyContactPh?: string;
  nationalIdHash?: string;
}

export interface StaffStats {
  totalKnowledge: number;
  knowledgeByLevel: {
    beginner: number;
    intermediate: number;
    expert: number;
    instructor: number;
  };
  canTeachCount: number;
  totalPlayLogs: number;
  totalContentChecks: number;
  lastContentCheckDate: string | null;
}

class StaffDbService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  /**
   * Get staff member by ID
   */
  async getStaffById(staffId: string): Promise<StaffMember | null> {
    if (!staffId || staffId.trim() === '') {
      throw new Error('Staff ID is required');
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT
          staff_id as "staffId",
          stafflist_id as "stafflistId",
          staff_name as name,
          nickname,
          staff_email as email,
          staff_type as type,
          contact_ph as "contactPh",
          bank_account_number as "bankAccountNumber",
          bank_name as "bankName",
          national_id_hash as "nationalIdHash",
          home_address as "homeAddress",
          emergency_contact_name as "emergencyContactName",
          emergency_contact_ph as "emergencyContactPh",
          date_of_hire as "dateOfHire",
          created_at as "createdAt",
          updated_at as "updatedAt",
          profile_updated_at as "profileUpdatedAt"
        FROM staff_list
        WHERE staff_id = $1`,
        [staffId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching staff by ID from PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get staff member by email
   */
  async getStaffByEmail(email: string): Promise<StaffMember | null> {
    if (!email || email.trim() === '') {
      throw new Error('Email is required');
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT
          staff_id as "staffId",
          stafflist_id as "stafflistId",
          staff_name as name,
          nickname,
          staff_email as email,
          staff_type as type,
          contact_ph as "contactPh",
          bank_account_number as "bankAccountNumber",
          bank_name as "bankName",
          national_id_hash as "nationalIdHash",
          home_address as "homeAddress",
          emergency_contact_name as "emergencyContactName",
          emergency_contact_ph as "emergencyContactPh",
          date_of_hire as "dateOfHire",
          created_at as "createdAt",
          updated_at as "updatedAt",
          profile_updated_at as "profileUpdatedAt"
        FROM staff_list
        WHERE LOWER(staff_email) = LOWER($1)`,
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching staff by email from PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update staff profile (editable fields only)
   */
  async updateStaffProfile(
    staffId: string,
    updates: StaffProfileUpdate
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      if (updates.nickname !== undefined) {
        fields.push(`nickname = $${paramIndex++}`);
        values.push(updates.nickname);
      }
      if (updates.email !== undefined) {
        fields.push(`staff_email = $${paramIndex++}`);
        values.push(updates.email);
      }
      if (updates.contactPh !== undefined) {
        fields.push(`contact_ph = $${paramIndex++}`);
        values.push(updates.contactPh);
      }
      if (updates.bankAccountNumber !== undefined) {
        fields.push(`bank_account_number = $${paramIndex++}`);
        values.push(updates.bankAccountNumber);
      }
      if (updates.bankName !== undefined) {
        fields.push(`bank_name = $${paramIndex++}`);
        values.push(updates.bankName);
      }
      if (updates.homeAddress !== undefined) {
        fields.push(`home_address = $${paramIndex++}`);
        values.push(updates.homeAddress);
      }
      if (updates.emergencyContactName !== undefined) {
        fields.push(`emergency_contact_name = $${paramIndex++}`);
        values.push(updates.emergencyContactName);
      }
      if (updates.emergencyContactPh !== undefined) {
        fields.push(`emergency_contact_ph = $${paramIndex++}`);
        values.push(updates.emergencyContactPh);
      }
      if (updates.nationalIdHash !== undefined) {
        fields.push(`national_id_hash = $${paramIndex++}`);
        values.push(updates.nationalIdHash);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Always update profile_updated_at and updated_at
      fields.push(`profile_updated_at = CURRENT_TIMESTAMP`);
      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(staffId);

      const query = `
        UPDATE staff_list
        SET ${fields.join(', ')}
        WHERE staff_id = $${paramIndex}
      `;

      const result = await client.query(query, values);
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error updating staff profile in PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all staff members (for directory)
   */
  async getAllStaff(): Promise<StaffMember[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `SELECT
          staff_id as "staffId",
          stafflist_id as "stafflistId",
          staff_name as name,
          nickname,
          staff_email as email,
          staff_type as type,
          contact_ph as "contactPh",
          bank_account_number as "bankAccountNumber",
          bank_name as "bankName",
          national_id_hash as "nationalIdHash",
          home_address as "homeAddress",
          emergency_contact_name as "emergencyContactName",
          emergency_contact_ph as "emergencyContactPh",
          date_of_hire as "dateOfHire",
          created_at as "createdAt",
          updated_at as "updatedAt",
          profile_updated_at as "profileUpdatedAt"
        FROM staff_list
        ORDER BY staff_name ASC`
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching all staff from PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get staff statistics (knowledge, play logs, content checks)
   */
  async getStaffStats(staffId: string): Promise<StaffStats> {
    const client = await this.pool.connect();

    try {
      // Get knowledge stats - staff_knowledge uses stafflist_id, not staff_id
      // First get the stafflist_id for this staff member
      const staffInfoResult = await client.query(
        `SELECT stafflist_id FROM staff_list WHERE staff_id = $1`,
        [staffId]
      );

      if (staffInfoResult.rows.length === 0) {
        throw new Error('Staff member not found');
      }

      const stafflistId = staffInfoResult.rows[0].stafflist_id;

      // Get knowledge stats using stafflist_id
      const knowledgeResult = await client.query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN confidence_level = 1 THEN 1 ELSE 0 END) as beginner,
          SUM(CASE WHEN confidence_level = 2 THEN 1 ELSE 0 END) as intermediate,
          SUM(CASE WHEN confidence_level = 3 THEN 1 ELSE 0 END) as expert,
          SUM(CASE WHEN confidence_level = 4 THEN 1 ELSE 0 END) as instructor,
          SUM(CASE WHEN can_teach = true THEN 1 ELSE 0 END) as can_teach
        FROM staff_knowledge
        WHERE staff_member_id = $1`,
        [stafflistId]
      );

      // Get play logs count - play_logs.staff_list_id contains stafflist_id values
      const playLogsResult = await client.query(
        `SELECT COUNT(*) as total
        FROM play_logs
        WHERE staff_list_id = $1`,
        [stafflistId]
      );

      // Get content checks count and last check date - content_checks uses inspector_id with stafflist_id values
      const contentChecksResult = await client.query(
        `SELECT
          COUNT(*) as total,
          MAX(check_date) as last_check_date
        FROM content_checks
        WHERE inspector_id = $1`,
        [stafflistId]
      );

      const knowledge = knowledgeResult.rows[0];
      const contentChecks = contentChecksResult.rows[0];

      return {
        totalKnowledge: parseInt(knowledge.total) || 0,
        knowledgeByLevel: {
          beginner: parseInt(knowledge.beginner) || 0,
          intermediate: parseInt(knowledge.intermediate) || 0,
          expert: parseInt(knowledge.expert) || 0,
          instructor: parseInt(knowledge.instructor) || 0,
        },
        canTeachCount: parseInt(knowledge.can_teach) || 0,
        totalPlayLogs: parseInt(playLogsResult.rows[0].total) || 0,
        totalContentChecks: parseInt(contentChecks.total) || 0,
        lastContentCheckDate: contentChecks.last_check_date || null,
      };
    } catch (error) {
      console.error('Error fetching staff stats from PostgreSQL:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all staff members with their statistics in a single optimized query
   * Uses JOINs and GROUP BY to avoid N+1 query problem
   */
  async getAllStaffWithStats(): Promise<Array<StaffMember & { stats: StaffStats }>> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          sl.staff_id,
          sl.stafflist_id,
          sl.staff_name,
          sl.nickname,
          sl.staff_email,
          sl.staff_type,
          sl.contact_ph,
          sl.bank_account_number,
          sl.bank_name,
          sl.national_id_hash,
          sl.home_address,
          sl.emergency_contact_name,
          sl.emergency_contact_ph,
          sl.date_of_hire,
          sl.created_at,
          sl.updated_at,
          sl.profile_updated_at,
          COUNT(DISTINCT sk.id) as total_knowledge,
          SUM(CASE WHEN sk.confidence_level = 1 THEN 1 ELSE 0 END) as beginner_knowledge,
          SUM(CASE WHEN sk.confidence_level = 2 THEN 1 ELSE 0 END) as intermediate_knowledge,
          SUM(CASE WHEN sk.confidence_level = 3 THEN 1 ELSE 0 END) as expert_knowledge,
          SUM(CASE WHEN sk.confidence_level = 4 THEN 1 ELSE 0 END) as instructor_knowledge,
          SUM(CASE WHEN sk.can_teach = true THEN 1 ELSE 0 END) as can_teach_count,
          COUNT(DISTINCT pl.id) as total_play_logs,
          COUNT(DISTINCT cc.id) as total_content_checks,
          MAX(cc.check_date) as last_content_check_date
        FROM staff_list sl
        LEFT JOIN staff_knowledge sk ON sk.staff_member_id = sl.stafflist_id
        LEFT JOIN play_logs pl ON pl.staff_list_id = sl.stafflist_id
        LEFT JOIN content_checks cc ON cc.inspector_id = sl.stafflist_id
        GROUP BY sl.staff_id
        ORDER BY sl.staff_name ASC
      `);

      return result.rows.map(row => ({
        staffId: row.staff_id,
        stafflistId: row.stafflist_id,
        name: row.staff_name,
        nickname: row.nickname,
        email: row.staff_email,
        type: row.staff_type,
        contactPh: row.contact_ph,
        bankAccountNumber: row.bank_account_number,
        bankName: row.bank_name,
        nationalIdHash: row.national_id_hash,
        homeAddress: row.home_address,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPh: row.emergency_contact_ph,
        dateOfHire: row.date_of_hire,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        profileUpdatedAt: row.profile_updated_at,
        stats: {
          totalKnowledge: parseInt(row.total_knowledge) || 0,
          knowledgeByLevel: {
            beginner: parseInt(row.beginner_knowledge) || 0,
            intermediate: parseInt(row.intermediate_knowledge) || 0,
            expert: parseInt(row.expert_knowledge) || 0,
            instructor: parseInt(row.instructor_knowledge) || 0,
          },
          canTeachCount: parseInt(row.can_teach_count) || 0,
          totalPlayLogs: parseInt(row.total_play_logs) || 0,
          totalContentChecks: parseInt(row.total_content_checks) || 0,
          lastContentCheckDate: row.last_content_check_date || null,
        },
      }));
    } catch (error) {
      console.error('Error fetching staff with stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

export default StaffDbService;
