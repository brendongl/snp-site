'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format, addDays, parse } from 'date-fns';
import { ShiftCard, ShiftAssignment } from './ShiftCard';

interface RosterCalendarGridProps {
  weekStart: string; // ISO date string (YYYY-MM-DD) of Monday
  shifts: ShiftAssignment[];
  onShiftClick?: (shift: ShiftAssignment) => void;
  onShiftEdit?: (shift: ShiftAssignment) => void;
  editable?: boolean;
  loading?: boolean;
  className?: string;
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function RosterCalendarGrid({
  weekStart,
  shifts,
  onShiftClick,
  onShiftEdit,
  editable = true,
  loading = false,
  className,
}: RosterCalendarGridProps) {
  // Parse week start date
  const startDate = parse(weekStart, 'yyyy-MM-dd', new Date());

  // Group shifts by day of week
  const shiftsByDay: Record<string, ShiftAssignment[]> = DAYS_OF_WEEK.reduce(
    (acc, day) => {
      acc[day] = shifts
        .filter((s) => s.day_of_week === day)
        .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
      return acc;
    },
    {} as Record<string, ShiftAssignment[]>
  );

  // Loading state
  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4', className)}>
        {DAYS_OF_WEEK.map((day) => (
          <Card key={day}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4', className)}>
      {DAYS_OF_WEEK.map((day, index) => {
        const dayDate = addDays(startDate, index);
        const dayShifts = shiftsByDay[day] || [];

        return (
          <Card key={day} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                {day}
                <div className="text-xs text-muted-foreground font-normal">
                  {format(dayDate, 'MMM d, yyyy')}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-2">
              {dayShifts.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                  No shifts scheduled
                </div>
              ) : (
                dayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id || `${shift.staff_id}-${shift.shift_type}`}
                    shift={shift}
                    onEdit={onShiftEdit ? () => onShiftEdit(shift) : undefined}
                    editable={editable}
                    showViolations={true}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
