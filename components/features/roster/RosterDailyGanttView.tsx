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
  onBack?: () => void;
  className?: string;
}

// Role color mapping
const ROLE_COLORS = {
  cafe: 'bg-blue-500 border-blue-600',
  floor: 'bg-purple-500 border-purple-600',
  opening: 'bg-green-500 border-green-600',
  closing: 'bg-red-500 border-red-600',
};

// Generate hour markers (store hours typically 9am-midnight)
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function RosterDailyGanttView({
  date,
  shifts,
  staffMembers,
  onShiftClick,
  onBack,
  className,
}: RosterDailyGanttViewProps) {
  const dateObj = new Date(date + 'T00:00:00');

  // Group shifts by staff member
  const shiftsByStaff = staffMembers.reduce((acc, staff) => {
    acc[staff.id] = shifts.filter((s) => s.staff_id === staff.id);
    return acc;
  }, {} as Record<string, ShiftAssignment[]>);

  // Convert time string (HH:MM) to hour decimal for positioning
  const timeToHours = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + minutes / 60;
  };

  // Calculate shift block position and width
  const getShiftStyle = (start: string, end: string) => {
    const startHour = timeToHours(start);
    const endHour = timeToHours(end);
    const duration = endHour - startHour;

    // Position as percentage of 24-hour day
    const left = (startHour / 24) * 100;
    const width = (duration / 24) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  // Format hour label (e.g., "9am", "12pm", "6pm")
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
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
              <div className="space-y-1">
                {staffMembers.map((staff) => {
                  const staffShifts = shiftsByStaff[staff.id] || [];

                  return (
                    <div
                      key={staff.id}
                      className="relative h-16 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      {/* Staff Name */}
                      <div className="absolute left-0 top-0 bottom-0 w-32 flex items-center px-3 bg-muted/50 border-r z-10">
                        <span className="font-medium text-sm truncate">
                          {staff.name}
                        </span>
                      </div>

                      {/* Hour Grid Lines */}
                      <div className="absolute inset-0 flex pl-32">
                        {HOURS.map((hour) => (
                          <div
                            key={hour}
                            className="flex-1 border-r last:border-r-0 border-dashed border-muted-foreground/20"
                          />
                        ))}
                      </div>

                      {/* Shift Blocks */}
                      <div className="absolute inset-0 pl-32">
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
                                'absolute top-2 h-12 rounded-lg border-2 flex flex-col items-center justify-center text-white text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity shadow-md',
                                roleColor,
                                shift.has_violation && 'ring-2 ring-red-500'
                              )}
                              style={style}
                              onClick={() => onShiftClick?.(shift)}
                            >
                              <span className="font-semibold">
                                {shift.scheduled_start.substring(0, 5)} -{' '}
                                {shift.scheduled_end.substring(0, 5)}
                              </span>
                              <span className="text-[10px] opacity-90 capitalize">
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
