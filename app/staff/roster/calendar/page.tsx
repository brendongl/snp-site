'use client';

import { RosterWeeklyStaffView } from '@/components/features/roster/RosterWeeklyStaffView';
import { RosterDailyGanttView } from '@/components/features/roster/RosterDailyGanttView';
import { ShiftEditDialog } from '@/components/features/roster/ShiftEditDialog';
import { WeekSelector } from '@/components/features/roster/WeekSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfWeek } from 'date-fns';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
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
  const [availability, setAvailability] = useState<any[]>([]);
  const [preferredTimes, setPreferredTimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode and selected shift for editing
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingShift, setEditingShift] = useState<ShiftAssignment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Publish state
  const [unpublishedCount, setUnpublishedCount] = useState(0);
  const [rosterStatus, setRosterStatus] = useState<'draft' | 'published'>('draft');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Fetch shifts for the selected week
  const fetchShifts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch shifts, availability, and preferred times in parallel
      const [shiftsResponse, availabilityResponse, preferredTimesResponse] = await Promise.all([
        fetch(`/api/roster/shifts?week_start=${selectedWeek}`),
        fetch(`/api/roster/availability?week_start=${selectedWeek}`),
        fetch(`/api/roster/preferred-times`)
      ]);

      // Process shifts
      if (!shiftsResponse.ok) {
        throw new Error(`Failed to fetch shifts: ${shiftsResponse.statusText}`);
      }
      const shiftsData = await shiftsResponse.json();
      setShifts(shiftsData.shifts || []);

      // Process availability
      if (!availabilityResponse.ok) {
        throw new Error(`Failed to fetch availability: ${availabilityResponse.statusText}`);
      }
      const availabilityData = await availabilityResponse.json();
      setAvailability(availabilityData.availability || []);

      // Process preferred times
      if (!preferredTimesResponse.ok) {
        throw new Error(`Failed to fetch preferred times: ${preferredTimesResponse.statusText}`);
      }
      const preferredTimesData = await preferredTimesResponse.json();
      setPreferredTimes(preferredTimesData.preferred_times || []);

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

  // Fetch unpublished count
  const fetchUnpublishedCount = async () => {
    try {
      const response = await fetch(`/api/roster/${selectedWeek}/unpublished-count`);
      if (response.ok) {
        const data = await response.json();
        setUnpublishedCount(data.unpublished_count);
        setRosterStatus(data.roster_status);
      }
    } catch (err) {
      console.error('Error fetching unpublished count:', err);
    }
  };

  // Handle publish roster
  const handlePublish = async () => {
    if (unpublishedCount === 0) return;

    if (!confirm(`Publish roster for ${format(new Date(selectedWeek), 'MMM d, yyyy')}?\n\n${unpublishedCount} shift(s) will be published and visible to staff.`)) {
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch(`/api/roster/${selectedWeek}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          published_by: null, // TODO: Get staff ID from auth
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to publish roster');
      }

      const data = await response.json();

      // Show success message
      alert(`✅ Roster published successfully!\n\n${data.changes_published} shift(s) are now visible to staff.`);

      // Refresh data
      await fetchShifts();
      await fetchUnpublishedCount();
    } catch (err) {
      console.error('Error publishing roster:', err);
      alert('❌ Failed to publish roster. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle clear all shifts for selected week
  const handleClearAll = async () => {
    if (shifts.length === 0) {
      alert('No shifts to clear for this week.');
      return;
    }

    if (!confirm(`Clear ALL shifts for ${format(new Date(selectedWeek), 'MMM d, yyyy')}?\n\n${shifts.length} shift(s) will be permanently deleted.\n\nThis action cannot be undone.`)) {
      return;
    }

    setIsClearing(true);
    try {
      // Delete all shifts for this week
      const deletePromises = shifts.map(shift =>
        fetch(`/api/roster/shifts/${shift.id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      // Show success message
      alert(`✅ All shifts cleared successfully!\n\n${shifts.length} shift(s) were deleted.`);

      // Refresh data
      await fetchShifts();
      await fetchUnpublishedCount();
    } catch (err) {
      console.error('Error clearing shifts:', err);
      alert('❌ Failed to clear all shifts. Please try again.');
    } finally {
      setIsClearing(false);
    }
  };

  // Fetch shifts when week changes
  useEffect(() => {
    fetchShifts();
    fetchUnpublishedCount();
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
      await fetchUnpublishedCount(); // Update publish button count
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
      scheduled_start: '', // Let dialog apply default times based on day of week
      scheduled_end: '', // Let dialog apply default times based on day of week
      role_required: 'floor',
      shift_type: 'day',
      has_violation: false,
    };

    setEditingShift(newShift);
    setIsEditDialogOpen(true);
  };

  // Handle shift delete - refresh data without changing selected week
  const handleShiftDelete = async () => {
    await fetchShifts();
    await fetchUnpublishedCount();
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

        <div className="flex gap-2">
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

          <Button
            variant="destructive"
            onClick={handleClearAll}
            disabled={shifts.length === 0 || isClearing || loading}
          >
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All
              </>
            )}
          </Button>

          <Button
            variant="default"
            onClick={handlePublish}
            disabled={unpublishedCount === 0 || isPublishing}
            className={unpublishedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                Publish {unpublishedCount > 0 && `(${unpublishedCount})`}
              </>
            )}
          </Button>
        </div>
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
              availability={availability}
              preferredTimes={preferredTimes}
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
        onDelete={handleShiftDelete}
        staffMembers={staffMembers}
      />
    </div>
  );
}
