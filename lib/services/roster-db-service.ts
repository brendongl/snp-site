/**
 * Roster Database Service
 * Version: 2.0.0
 * Phase 1: Core API
 *
 * Service layer for rostering system database operations.
 * Handles CRUD operations for rosters, shifts, availability, and clock records.
 */

import pool from '@/lib/db/postgres';
import type {
  RosterShift,
  StaffAvailability,
  ClockRecord,
  ShiftSwap,
  RosterNotification,
  RosterHoliday,
  PayAdjustment,
  StoreNotification,
  StaffMember
} from '@/types';

export class RosterDbService {
  // ========================================
  // Roster Shifts
  // ========================================

  /**
   * Get all shifts for a specific week
   */
  static async getShiftsByWeek(weekStart: string): Promise<RosterShift[]> {
    const query = `
      SELECT
        id,
        roster_week_start,
        day_of_week,
        shift_type,
        staff_id,
        scheduled_start,
        scheduled_end,
        role_required,
        shift_notes,
        clock_in_reminder,
        created_at,
        updated_at
      FROM roster_shifts
      WHERE roster_week_start = $1
      ORDER BY
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        scheduled_start
    `;

    const result = await pool.query(query, [weekStart]);
    return result.rows;
  }

  /**
   * Get shifts for a specific staff member
   */
  static async getShiftsByStaffId(staffId: string, startDate?: string, endDate?: string): Promise<RosterShift[]> {
    let query = `
      SELECT *
      FROM roster_shifts
      WHERE staff_id = $1
    `;

    const params: any[] = [staffId];

    if (startDate && endDate) {
      query += ` AND roster_week_start >= $2 AND roster_week_start <= $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY roster_week_start, scheduled_start`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Create a new shift
   */
  static async createShift(shift: Omit<RosterShift, 'id' | 'created_at' | 'updated_at'>): Promise<RosterShift> {
    const query = `
      INSERT INTO roster_shifts (
        roster_week_start,
        day_of_week,
        shift_type,
        staff_id,
        scheduled_start,
        scheduled_end,
        role_required,
        shift_notes,
        clock_in_reminder
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      shift.roster_week_start,
      shift.day_of_week,
      shift.shift_type,
      shift.staff_id,
      shift.scheduled_start,
      shift.scheduled_end,
      shift.role_required,
      shift.shift_notes || null,
      shift.clock_in_reminder || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update a shift
   */
  static async updateShift(id: string, updates: Partial<RosterShift>): Promise<RosterShift> {
    const allowedFields = [
      'day_of_week',
      'shift_type',
      'staff_id',
      'scheduled_start',
      'scheduled_end',
      'role_required',
      'shift_notes',
      'clock_in_reminder'
    ];

    const setClause = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!setClause) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE roster_shifts
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, ...Object.keys(updates).filter(key => allowedFields.includes(key)).map(key => (updates as any)[key])];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete a shift
   */
  static async deleteShift(id: string): Promise<void> {
    await pool.query('DELETE FROM roster_shifts WHERE id = $1', [id]);
  }

  /**
   * Delete all shifts for a week (used when regenerating roster)
   */
  static async deleteShiftsByWeek(weekStart: string): Promise<void> {
    await pool.query('DELETE FROM roster_shifts WHERE roster_week_start = $1', [weekStart]);
  }

  // ========================================
  // Staff Availability
  // ========================================

  /**
   * Get availability for a specific staff member
   */
  static async getAvailabilityByStaffId(staffId: string): Promise<StaffAvailability[]> {
    const query = `
      SELECT *
      FROM staff_availability
      WHERE staff_id = $1
      ORDER BY
        CASE day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        hour_start
    `;

    const result = await pool.query(query, [staffId]);
    return result.rows;
  }

  /**
   * Get all staff availability (for roster generation)
   */
  static async getAllAvailability(): Promise<StaffAvailability[]> {
    const result = await pool.query('SELECT * FROM staff_availability ORDER BY staff_id');
    return result.rows;
  }

  /**
   * Upsert availability (insert or update if exists)
   */
  static async upsertAvailability(availability: Omit<StaffAvailability, 'id' | 'created_at' | 'updated_at'>): Promise<StaffAvailability> {
    const query = `
      INSERT INTO staff_availability (
        staff_id,
        day_of_week,
        hour_start,
        hour_end,
        availability_status
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (staff_id, day_of_week, hour_start, hour_end)
      DO UPDATE SET
        availability_status = EXCLUDED.availability_status,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      availability.staff_id,
      availability.day_of_week,
      availability.hour_start,
      availability.hour_end,
      availability.availability_status
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Bulk upsert availability (for weekly pattern updates)
   */
  static async bulkUpsertAvailability(availabilityList: Omit<StaffAvailability, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const availability of availabilityList) {
        await client.query(`
          INSERT INTO staff_availability (
            staff_id,
            day_of_week,
            hour_start,
            hour_end,
            availability_status
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (staff_id, day_of_week, hour_start, hour_end)
          DO UPDATE SET
            availability_status = EXCLUDED.availability_status,
            updated_at = NOW()
        `, [
          availability.staff_id,
          availability.day_of_week,
          availability.hour_start,
          availability.hour_end,
          availability.availability_status
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ========================================
  // Clock Records
  // ========================================

  /**
   * Get clock record by ID
   */
  static async getClockRecordById(id: string): Promise<ClockRecord | null> {
    const result = await pool.query('SELECT * FROM clock_records WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  /**
   * Get active clock-in for a staff member (no clock-out yet)
   */
  static async getActiveClockIn(staffId: string): Promise<ClockRecord | null> {
    const query = `
      SELECT *
      FROM clock_records
      WHERE staff_id = $1 AND clock_out_time IS NULL
      ORDER BY clock_in_time DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [staffId]);
    return result.rows[0] || null;
  }

  /**
   * Create a clock-in record
   */
  static async createClockIn(
    staffId: string,
    shiftId: string | null,
    location: any,
    rosteredStart: string | null,
    rosteredEnd: string | null,
    pointsAwarded: number
  ): Promise<ClockRecord> {
    const query = `
      INSERT INTO clock_records (
        staff_id,
        shift_id,
        clock_in_time,
        clock_in_location,
        rostered_start,
        rostered_end,
        points_awarded
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [staffId, shiftId, JSON.stringify(location), rosteredStart, rosteredEnd, pointsAwarded];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update clock-out
   */
  static async updateClockOut(
    clockRecordId: string,
    location: any,
    varianceReason: string | null,
    requiresApproval: boolean,
    pointsAwarded: number
  ): Promise<ClockRecord> {
    const query = `
      UPDATE clock_records
      SET
        clock_out_time = NOW(),
        clock_out_location = $2,
        variance_reason = $3,
        requires_approval = $4,
        points_awarded = points_awarded + $5
      WHERE id = $1
      RETURNING *
    `;

    const values = [clockRecordId, JSON.stringify(location), varianceReason, requiresApproval, pointsAwarded];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get clock records for a staff member (for hours summary)
   */
  static async getClockRecordsByStaffId(staffId: string, startDate?: string, endDate?: string): Promise<ClockRecord[]> {
    let query = `
      SELECT *
      FROM clock_records
      WHERE staff_id = $1
    `;

    const params: any[] = [staffId];

    if (startDate && endDate) {
      query += ` AND clock_in_time >= $2 AND clock_in_time <= $3`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY clock_in_time DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get unapproved clock records (for approval queue)
   */
  static async getUnapprovedClockRecords(): Promise<ClockRecord[]> {
    const query = `
      SELECT *
      FROM clock_records
      WHERE requires_approval = true AND approved_by IS NULL
      ORDER BY clock_in_time DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Approve a clock record
   */
  static async approveClockRecord(
    clockRecordId: string,
    approvedBy: string,
    approvedHours: number
  ): Promise<ClockRecord> {
    const query = `
      UPDATE clock_records
      SET
        approved_by = $2,
        approved_at = NOW(),
        approved_hours = $3,
        requires_approval = false
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [clockRecordId, approvedBy, approvedHours]);
    return result.rows[0];
  }

  // ========================================
  // Holidays
  // ========================================

  /**
   * Get all holidays
   */
  static async getAllHolidays(): Promise<RosterHoliday[]> {
    const result = await pool.query('SELECT * FROM roster_holidays ORDER BY start_date');
    return result.rows;
  }

  /**
   * Get holiday for a specific date
   */
  static async getHolidayByDate(date: string): Promise<RosterHoliday | null> {
    const query = `
      SELECT *
      FROM roster_holidays
      WHERE $1 BETWEEN start_date AND end_date
      LIMIT 1
    `;

    const result = await pool.query(query, [date]);
    return result.rows[0] || null;
  }

  /**
   * Create a new holiday
   */
  static async createHoliday(holiday: {
    holiday_name: string;
    start_date: string;
    end_date: string;
    pay_multiplier: number;
    is_recurring: boolean;
  }): Promise<RosterHoliday> {
    const query = `
      INSERT INTO roster_holidays (
        holiday_name,
        start_date,
        end_date,
        pay_multiplier,
        is_recurring
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      holiday.holiday_name,
      holiday.start_date,
      holiday.end_date,
      holiday.pay_multiplier,
      holiday.is_recurring
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update an existing holiday
   */
  static async updateHoliday(id: string, updates: Partial<{
    holiday_name: string;
    start_date: string;
    end_date: string;
    pay_multiplier: number;
    is_recurring: boolean;
  }>): Promise<RosterHoliday> {
    const allowedFields = ['holiday_name', 'start_date', 'end_date', 'pay_multiplier', 'is_recurring'];

    const setClause = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');

    if (!setClause) {
      throw new Error('No valid fields to update');
    }

    const query = `
      UPDATE roster_holidays
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [id, ...Object.keys(updates).filter(key => allowedFields.includes(key)).map(key => (updates as any)[key])];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Delete a holiday
   */
  static async deleteHoliday(id: string): Promise<void> {
    await pool.query('DELETE FROM roster_holidays WHERE id = $1', [id]);
  }

  // ========================================
  // Shift Swaps
  // ========================================

  /**
   * Get all shift swap requests for a staff member
   */
  static async getShiftSwapsByStaffId(staffId: string): Promise<ShiftSwap[]> {
    const query = `
      SELECT *
      FROM shift_swaps
      WHERE requesting_staff_id = $1 OR target_staff_id = $1
      ORDER BY requested_at DESC
    `;

    const result = await pool.query(query, [staffId]);
    return result.rows;
  }

  /**
   * Get pending shift swap requests (for admin approval)
   */
  static async getPendingShiftSwaps(): Promise<ShiftSwap[]> {
    const query = `
      SELECT *
      FROM shift_swaps
      WHERE status = 'pending'
      ORDER BY requested_at ASC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Create a new shift swap request
   */
  static async createShiftSwap(swap: {
    shift_id: string;
    requesting_staff_id: string;
    target_staff_id: string;
    reason?: string;
  }): Promise<ShiftSwap> {
    const query = `
      INSERT INTO shift_swaps (
        shift_id,
        requesting_staff_id,
        target_staff_id,
        status,
        reason
      ) VALUES ($1, $2, $3, 'pending', $4)
      RETURNING *
    `;

    const values = [
      swap.shift_id,
      swap.requesting_staff_id,
      swap.target_staff_id,
      swap.reason || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Approve a shift swap (admin or auto)
   */
  static async approveShiftSwap(
    swapId: string,
    resolvedBy: string | null,
    isAutoApproved: boolean,
    notes?: string
  ): Promise<ShiftSwap> {
    const status = isAutoApproved ? 'auto_approved' : 'admin_approved';

    const query = `
      UPDATE shift_swaps
      SET
        status = $2,
        resolved_at = NOW(),
        resolved_by = $3,
        notes = $4
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [swapId, status, resolvedBy, notes || null]);
    return result.rows[0];
  }

  /**
   * Veto a shift swap
   */
  static async vetoShiftSwap(
    swapId: string,
    resolvedBy: string,
    notes?: string
  ): Promise<ShiftSwap> {
    const query = `
      UPDATE shift_swaps
      SET
        status = 'vetoed',
        resolved_at = NOW(),
        resolved_by = $2,
        notes = $3
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [swapId, resolvedBy, notes || null]);
    return result.rows[0];
  }

  /**
   * Get shift swap by ID
   */
  static async getShiftSwapById(id: string): Promise<ShiftSwap | null> {
    const result = await pool.query('SELECT * FROM shift_swaps WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // ========================================
  // Staff Members (extended for rostering)
  // ========================================

  /**
   * Get all staff members with rostering fields
   */
  static async getAllStaffWithRosteringInfo(): Promise<StaffMember[]> {
    const query = `
      SELECT
        id,
        name,
        email,
        nickname,
        points,
        vikunja_user_id,
        vikunja_username,
        base_hourly_rate,
        discord_username,
        has_keys,
        available_roles
      FROM staff_list
      WHERE active = true
      ORDER BY name
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Update staff rostering info
   */
  static async updateStaffRosteringInfo(
    staffId: string,
    updates: {
      base_hourly_rate?: number;
      discord_username?: string;
      has_keys?: boolean;
      available_roles?: string[];
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 2;

    if (updates.base_hourly_rate !== undefined) {
      fields.push(`base_hourly_rate = $${paramIndex++}`);
      values.push(updates.base_hourly_rate);
    }

    if (updates.discord_username !== undefined) {
      fields.push(`discord_username = $${paramIndex++}`);
      values.push(updates.discord_username);
    }

    if (updates.has_keys !== undefined) {
      fields.push(`has_keys = $${paramIndex++}`);
      values.push(updates.has_keys);
    }

    if (updates.available_roles !== undefined) {
      fields.push(`available_roles = $${paramIndex++}`);
      values.push(updates.available_roles);
    }

    if (fields.length === 0) {
      return;
    }

    const query = `
      UPDATE staff_list
      SET ${fields.join(', ')}
      WHERE id = $1
    `;

    await pool.query(query, [staffId, ...values]);
  }

  // ========================================
  // Roster Rules
  // ========================================

  /**
   * Get all active roster rules
   */
  static async getActiveRules(): Promise<any[]> {
    const query = `
      SELECT
        id,
        rule_text,
        parsed_constraint,
        weight,
        is_active,
        expires_at,
        created_by,
        created_at,
        updated_at
      FROM roster_rules
      WHERE is_active = true
        AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
      ORDER BY weight DESC, created_at DESC
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Create a new roster rule
   */
  static async createRule(
    ruleText: string,
    parsedConstraint: any,
    weight: number,
    createdBy: string,
    expiresAt: string | null
  ): Promise<any> {
    const query = `
      INSERT INTO roster_rules (
        rule_text,
        parsed_constraint,
        weight,
        created_by,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(query, [
      ruleText,
      JSON.stringify(parsedConstraint),
      weight,
      createdBy,
      expiresAt
    ]);

    return result.rows[0];
  }

  /**
   * Deactivate a rule
   */
  static async deactivateRule(ruleId: string): Promise<void> {
    const query = `
      UPDATE roster_rules
      SET is_active = false,
          updated_at = NOW()
      WHERE id = $1
    `;

    await pool.query(query, [ruleId]);
  }

  /**
   * Get rule by ID
   */
  static async getRuleById(ruleId: string): Promise<any | null> {
    const query = `
      SELECT *
      FROM roster_rules
      WHERE id = $1
    `;

    const result = await pool.query(query, [ruleId]);
    return result.rows[0] || null;
  }
}

export default RosterDbService;
