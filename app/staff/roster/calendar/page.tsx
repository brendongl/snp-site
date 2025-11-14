'use client';

import { RosterWeeklyStaffView } from '@/components/features/roster/RosterWeeklyStaffView';
import { RosterDailyGanttView } from '@/components/features/roster/RosterDailyGanttView';
import { WeekSelector } from '@/components/features/roster/WeekSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format, startOfWeek } from 'date-fns';
import { Loader2, RefreshCw, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ShiftAssignment } from '@/components/features/roster/ShiftCard';

type ViewMode = 'week' | 'day';

export default function StaffRosterCalendarPage() {
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

  // View mode and selected date for day view
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Fetch shifts for the selected week (published only)
  const fetchShifts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch shifts, availability, and preferred times in parallel
      const [shiftsResponse, availabilityResponse, preferredTimesResponse] = await Promise.all([
        fetch(`/api/roster/shifts?week_start=${selectedWeek}&published_only=true`),
        fetch(`/api/roster/availability?week_start=${selectedWeek}`),
        fetch(`/api/roster/preferred-times`)
      ]);

      // Process shifts
      if (!shiftsResponse.ok) {
        throw new Error(`Failed to fetch shifts: ${shiftsResponse.statusText}`);
      }
      const shiftsData = await shiftsResponse.json();

      // Filter to only show published shifts (double-check client-side)
      const publishedShifts = (shiftsData.shifts || []).filter((shift: any) => shift.is_published === true);
      setShifts(publishedShifts);

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

  // Fetch shifts when week changes
  useEffect(() => {
    fetchShifts();
  }, [selectedWeek]);

  // Handle day header click - switch to Gantt view (read-only)
  const handleDayHeaderClick = (date: string) => {
    setSelectedDate(date);
    setViewMode('day');
  };

  // No-op handlers for read-only mode (prevent editing)
  const handleShiftClick = (shift: ShiftAssignment) => {
    // Do nothing - read-only mode
  };

  const handleDayCellClick = (staffId: string, date: string) => {
    // Do nothing - read-only mode (no shift creation)
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Eye className="h-8 w-8 text-muted-foreground" />
            My Roster
          </h1>
          <p className="text-muted-foreground">
            View published weekly schedules (read-only)
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
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
      </div>

      {/* Week Selector */}
      {viewMode === 'week' && (
        <Card>
          <CardHeader>
            <CardTitle>Select Week</CardTitle>
            <CardDescription>
              Choose a week to view your published roster. Click on any day to see detailed timeline.
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

      {/* No Published Roster Message */}
      {!loading && shifts.length === 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <p className="text-yellow-700 dark:text-yellow-300">
              No published roster for this week yet. Check back later or contact admin.
            </p>
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
              readOnly={true}
            />
          ) : (
            <RosterDailyGanttView
              date={selectedDate}
              shifts={dayShifts}
              staffMembers={staffMembers}
              onShiftClick={handleShiftClick}
              onCreateShift={(staffId: string, date: string) => {}}
              onBack={() => setViewMode('week')}
              readOnly={true}
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
              <div className="text-sm text-muted-foreground">Staff Scheduled</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {shifts.filter(s => s.shift_type === 'opening').length}
              </div>
              <div className="text-sm text-muted-foreground">Opening Shifts</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {shifts.filter(s => s.shift_type === 'closing').length}
              </div>
              <div className="text-sm text-muted-foreground">Closing Shifts</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
