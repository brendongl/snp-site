'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ShiftAssignment } from './ShiftCard';
import { ArrowLeft } from 'lucide-react';

interface RosterDailyGanttViewProps {
  date: string; // ISO date string (YYYY-MM-DD)
  shifts: ShiftAssignment[];
  staffMembers: Array<{ id: string; name: string }>;
  onShiftClick?: (shift: ShiftAssignment) => void;
  onCreateShift?: (staffId: string, date: string) => void;
  onBack?: () => void;
  className?: string;
  readOnly?: boolean; // If true, disable all editing interactions
}

// Role color mapping
const ROLE_COLORS = {
  cafe: 'bg-blue-500 border-blue-600',
  floor: 'bg-purple-500 border-purple-600',
  opening: 'bg-green-500 border-green-600',
  closing: 'bg-red-500 border-red-600',
};

// Generate hour markers (8am to 2am = hours 8-26)
// Hours 24, 25, 26 represent midnight, 1am, 2am
const HOURS = Array.from({ length: 19 }, (_, i) => i + 8); // 8-26

export function RosterDailyGanttView({
  date,
  shifts,
  staffMembers,
  onShiftClick,
  onCreateShift,
  onBack,
  className,
  readOnly = false,
}: RosterDailyGanttViewProps) {
  const dateObj = new Date(date + 'T00:00:00');

  // Group shifts by staff member
  const shiftsByStaff = staffMembers.reduce((acc, staff) => {
    acc[staff.id] = shifts.filter((s) => s.staff_id === staff.id);
    return acc;
  }, {} as Record<string, ShiftAssignment[]>);

  // Convert time string (HH:MM) to hour decimal for positioning
  // Extended hours: 00:00 = 24 (midnight), 01:00 = 25, 02:00 = 26
  const timeToHours = (timeStr: string): number => {
    let [hours, minutes] = timeStr.split(':').map(Number);

    // Convert midnight (0) to extended hour 24
    if (hours === 0) hours = 24;
    // Convert 1am (1) to extended hour 25
    else if (hours === 1) hours = 25;
    // Convert 2am (2) to extended hour 26
    else if (hours === 2) hours = 26;

    return hours + minutes / 60;
  };

  // Calculate shift block position and width (relative to 8am-2am range)
  const getShiftStyle = (start: string, end: string) => {
    const startHour = timeToHours(start);
    const endHour = timeToHours(end);
    const duration = endHour - startHour;

    // Convert to position relative to 8am-2am (18 hour range)
    // 8am = 0%, 2am (26) = 100%
    const left = ((startHour - 8) / 18) * 100;
    const width = (duration / 18) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  // Format hour label (e.g., "8am", "12pm", "12am", "2am")
  const formatHour = (hour: number): string => {
    if (hour === 0 || hour === 24) return '12am';
    if (hour === 12) return '12pm';
    if (hour === 25) return '1am';
    if (hour === 26) return '2am';
    if (hour < 12) return `${hour}am`;
    if (hour > 12 && hour < 24) return `${hour - 12}pm`;
    return `${hour}am`;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Week
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {format(dateObj, 'EEEE, MMMM d, yyyy')}
          </h2>
          <p className="text-sm text-muted-foreground">
            Daily shift timeline
          </p>
        </div>
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Shift Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[1400px]">
              {/* Hour Headers */}
              <div className="relative h-8 border-b mb-2">
                <div className="absolute inset-0 flex">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 border-r last:border-r-0 text-center"
                    >
                      <span className="text-xs text-muted-foreground">
                        {formatHour(hour)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Rows */}
              <div className="space-y-0.5">
                {staffMembers.map((staff) => {
                  const staffShifts = shiftsByStaff[staff.id] || [];

                  return (
                    <div
                      key={staff.id}
                      className={cn(
                        "relative h-12 border rounded transition-colors",
                        !readOnly && "hover:bg-accent/50 cursor-pointer"
                      )}
                      onClick={() => !readOnly && onCreateShift?.(staff.id, date)}
                    >
                      {/* Staff Name */}
                      <div className="absolute left-0 top-0 bottom-0 w-28 flex items-center px-2 bg-muted/50 border-r z-10">
                        <span className="font-medium text-xs truncate">
                          {staff.name}
                        </span>
                      </div>

                      {/* Hour Grid Lines */}
                      <div className="absolute inset-0 flex pl-28">
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="flex-1 border-r last:border-r-0 border-dashed border-muted-foreground/10"
                          />
                        ))}
                      </div>

                      {/* Shift Blocks */}
                      <div className="absolute inset-0 pl-28">
                        {staffShifts.map((shift, index) => {
                          const style = getShiftStyle(
                            shift.scheduled_start,
                            shift.scheduled_end
                          );
                          const roleColor =
                            ROLE_COLORS[
                              shift.role_required as keyof typeof ROLE_COLORS
                            ] || 'bg-gray-500 border-gray-600';

                          return (
                            <div
                              key={index}
                              className={cn(
                                'absolute top-1 h-10 rounded border flex flex-col items-center justify-center text-white text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity shadow',
                                roleColor,
                                shift.has_violation && 'ring-1 ring-red-500'
                              )}
                              style={style}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!readOnly) {
                                  onShiftClick?.(shift);
                                }
                              }}
                            >
                              <span className="font-semibold">
                                {shift.scheduled_start.substring(0, 5)}-
                                {shift.scheduled_end.substring(0, 5)}
                              </span>
                              <span className="text-[9px] opacity-90 capitalize">
                                {shift.role_required}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty State */}
              {staffMembers.every((staff) => shiftsByStaff[staff.id]?.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  No shifts scheduled for this day
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
            <span className="font-medium">Roles:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500 border-2 border-blue-600" />
              <span>Cafe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-purple-500 border-2 border-purple-600" />
              <span>Floor</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500 border-2 border-green-600" />
              <span>Opening</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500 border-2 border-red-600" />
              <span>Closing</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
