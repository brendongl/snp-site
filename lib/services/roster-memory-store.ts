/**
 * In-Memory Roster Store (Phase 3.1)
 *
 * Temporary storage for custom shifts created/edited by users.
 * This will be replaced with database persistence in Phase 3.2.
 */

export interface RosterShift {
  id: string;
  staff_id: string;
  staff_name: string;
  scheduled_start: string; // HH:MM format
  scheduled_end: string;   // HH:MM format
  role_required: string;
  day_of_week: string;
  week_start: string;      // YYYY-MM-DD format
  has_violation?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Map structure: week_start (YYYY-MM-DD) -> array of shifts
const inMemoryShifts = new Map<string, RosterShift[]>();

export const rosterMemoryStore = {
  /**
   * Get all shifts for a specific week
   */
  getShiftsForWeek(weekStart: string): RosterShift[] {
    return inMemoryShifts.get(weekStart) || [];
  },

  /**
   * Add a new shift
   */
  addShift(shift: RosterShift): void {
    const weekShifts = inMemoryShifts.get(shift.week_start) || [];
    weekShifts.push(shift);
    inMemoryShifts.set(shift.week_start, weekShifts);
  },

  /**
   * Update an existing shift by ID
   */
  updateShift(id: string, updates: Partial<RosterShift>): RosterShift | null {
    for (const [weekKey, shifts] of inMemoryShifts.entries()) {
      const shiftIndex = shifts.findIndex((s) => s.id === id);
      if (shiftIndex !== -1) {
        shifts[shiftIndex] = {
          ...shifts[shiftIndex],
          ...updates,
          updated_at: new Date().toISOString(),
        };
        return shifts[shiftIndex];
      }
    }
    return null;
  },

  /**
   * Delete a shift by ID
   */
  deleteShift(id: string): boolean {
    for (const [weekKey, shifts] of inMemoryShifts.entries()) {
      const shiftIndex = shifts.findIndex((s) => s.id === id);
      if (shiftIndex !== -1) {
        shifts.splice(shiftIndex, 1);
        return true;
      }
    }
    return false;
  },

  /**
   * Find a shift by ID across all weeks
   */
  findShiftById(id: string): RosterShift | null {
    for (const shifts of inMemoryShifts.values()) {
      const shift = shifts.find((s) => s.id === id);
      if (shift) return shift;
    }
    return null;
  },

  /**
   * Clear all shifts (useful for testing)
   */
  clear(): void {
    inMemoryShifts.clear();
  },

  /**
   * Get all weeks with custom shifts
   */
  getAllWeeks(): string[] {
    return Array.from(inMemoryShifts.keys());
  },
};
