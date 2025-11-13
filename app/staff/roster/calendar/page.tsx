'use client';

import { RosterWeeklyStaffView } from '@/components/features/roster/RosterWeeklyStaffView';
import { RosterDailyGanttView } from '@/components/features/roster/RosterDailyGanttView';
import { ShiftEditDialog } from '@/components/features/roster/ShiftEditDialog';
import { WeekSelector } from '@/components/features/roster/WeekSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfWeek } from 'date-fns';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ShiftAssignment } from '@/components/features/roster/ShiftCard';

type ViewMode = 'week' | 'day';

export default function RosterCalendarPage() {
  const [selectedWeek, setSelectedWeek] = useState(() => {
    // Default to current week (Monday)
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  });

  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode and selected shift for editing
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingShift, setEditingShift] = useState<ShiftAssignment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch shifts for the selected week
  const fetchShifts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch shifts
      const shiftsResponse = await fetch(`/api/roster/shifts?week_start=${selectedWeek}`);
      if (!shiftsResponse.ok) {
        throw new Error(`Failed to fetch shifts: ${shiftsResponse.statusText}`);
      }
      const shiftsData = await shiftsResponse.json();
      setShifts(shiftsData.shifts || []);

      // Fetch ALL staff members (not just those with shifts)
      const staffResponse = await fetch('/api/staff-list');
      if (!staffResponse.ok) {
        throw new Error(`Failed to fetch staff: ${staffResponse.statusText}`);
      }
      const staffData = await staffResponse.json();

      // Map to simple format with nickname
      const allStaff = (staffData.staff || []).map((s: any) => ({
        id: s.id,
        name: s.nickname || s.name,
        fullName: s.name,
      }));
      setStaffMembers(allStaff);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  // Fetch shifts when week changes
  useEffect(() => {
    fetchShifts();
  }, [selectedWeek]);

  // Handle shift click - open edit dialog
  const handleShiftClick = (shift: ShiftAssignment) => {
    setEditingShift(shift);
    setIsEditDialogOpen(true);
  };

  // Handle day header click - switch to Gantt view
  const handleDayHeaderClick = (date: string) => {
    setSelectedDate(date);
    setViewMode('day');
  };

  // Handle day cell click - create new shift
  const handleDayCellClick = (staffId: string, date: string) => {
    handleCreateShift(staffId, date);
  };

  // Handle shift save (both create and update)
  const handleShiftSave = async (updatedShift: Partial<ShiftAssignment>) => {
    try {
      if (editingShift?.id) {
        // Update existing shift
        const response = await fetch(`/api/roster/shifts/${editingShift.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedShift),
        });

        if (!response.ok) {
          throw new Error('Failed to update shift');
        }
      } else {
        // Create new shift
        const response = await fetch('/api/roster/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...updatedShift,
            week_start: selectedWeek,
            day_of_week: editingShift?.day_of_week,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create shift');
        }
      }

      // Close dialog and refresh
      setIsEditDialogOpen(false);
      setEditingShift(null);
      await fetchShifts();
    } catch (error) {
      console.error('Error saving shift:', error);
      throw error; // Re-throw so dialog can handle it
    }
  };

  // Handle create new shift
  const handleCreateShift = (staffId: string, date: string) => {
    // Create a blank shift for this staff member on this day
    const dayOfWeek = format(new Date(date), 'EEEE');
    const staffMember = staffMembers.find((s) => s.id === staffId);

    const newShift: ShiftAssignment = {
      id: '',
      staff_id: staffId,
      staff_name: staffMember?.name || 'Unknown',
      day_of_week: dayOfWeek,
      scheduled_start: '09:00',
      scheduled_end: '17:00',
      role_required: 'floor',
      shift_type: 'day',
      has_violation: false,
    };

    setEditingShift(newShift);
    setIsEditDialogOpen(true);
  };

  // Filter shifts for selected date in day view
  const dayShifts = viewMode === 'day'
    ? shifts.filter((s) => {
        const shiftDate = new Date(selectedDate);
        const dayOfWeek = format(shiftDate, 'EEEE');
        return s.day_of_week === dayOfWeek;
      })
    : shifts;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roster Calendar</h1>
          <p className="text-muted-foreground">
            View and manage weekly staff schedules
          </p>
        </div>

        <Button
          variant="outline"
          onClick={fetchShifts}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Week Selector */}
      {viewMode === 'week' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Week</CardTitle>
            <CardDescription>
              Choose a week to view the roster. Click on any day to see detailed timeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeekSelector
              selectedWeek={selectedWeek}
              onChange={setSelectedWeek}
              minWeek="2025-01-01"
              maxWeek="2025-12-31"
            />
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main View */}
      {!loading && (
        <>
          {viewMode === 'week' ? (
            <RosterWeeklyStaffView
              weekStart={selectedWeek}
              shifts={shifts}
              staffMembers={staffMembers}
              onShiftClick={handleShiftClick}
              onDayClick={handleDayCellClick}
              onDayHeaderClick={handleDayHeaderClick}
            />
          ) : (
            <RosterDailyGanttView
              date={selectedDate}
              shifts={dayShifts}
              staffMembers={staffMembers}
              onShiftClick={handleShiftClick}
              onCreateShift={handleCreateShift}
              onBack={() => setViewMode('week')}
            />
          )}
        </>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Summary Card (Week View Only) */}
      {viewMode === 'week' && !loading && shifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Week Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{shifts.length}</div>
              <div className="text-sm text-muted-foreground">Total Shifts</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {new Set(shifts.map(s => s.staff_id)).size}
              </div>
              <div className="text-sm text-muted-foreground">Staff Members</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {shifts.filter(s => s.shift_type === 'opening').length}
              </div>
              <div className="text-sm text-muted-foreground">Opening Shifts</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {shifts.filter(s => s.has_violation).length}
              </div>
              <div className="text-sm text-muted-foreground">Violations</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <ShiftEditDialog
        shift={editingShift}
        open={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false);
          setEditingShift(null);
        }}
        onSave={handleShiftSave}
        staffMembers={staffMembers}
      />
    </div>
  );
}
