'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addDays, parse } from 'date-fns';
import { ShiftAssignment } from './ShiftCard';
import { ChevronRight, GripVertical } from 'lucide-react';
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface StaffAvailability {
  staff_id: string;
  staff_name: string;
  weekly_availability: Array<{
    day_of_week: string;
    hour_start: number;
    hour_end: number;
    status: 'available' | 'unavailable';
  }>;
  time_off: Array<{
    date: string;
    time_start: string;
    time_end: string;
    reason?: string;
  }>;
}

interface StaffPreferredTime {
  id: number;
  staff_id: string;
  staff_name: string;
  staff_nickname?: string;
  day_of_week: string;
  hour_start: number;
  hour_end: number;
}

interface RosterWeeklyStaffViewProps {
  weekStart: string; // ISO date string (YYYY-MM-DD) of Monday
  shifts: ShiftAssignment[];
  staffMembers: Array<{ id: string; name: string }>;
  availability?: StaffAvailability[];
  preferredTimes?: StaffPreferredTime[];
  onShiftClick?: (shift: ShiftAssignment) => void;
  onDayClick?: (staffId: string, date: string) => void; // Click empty cell to create shift
  onDayHeaderClick?: (date: string) => void; // Click day header to open Gantt view
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

// Role color mapping matching Homebase
const ROLE_COLORS = {
  supervisor: 'bg-[#ffa099]', // Coral/salmon (matches Homebase Supervisor)
  dealer: 'bg-[#a855f7]',      // Purple (matches Homebase Dealer)
  senior: 'bg-[#22c55e]',      // Green (matches Homebase Senior)
  barista: 'bg-[#3b82f6]',     // Blue (matches Homebase Barista)
  cafe: 'bg-[#3b82f6]',        // Blue
  floor: 'bg-[#ffa099]',       // Coral
  opening: 'bg-[#22c55e]',     // Green
  closing: 'bg-[#a855f7]',     // Purple
  'game master': 'bg-[#10b981]', // Teal green
};

// Sortable Staff Row Component
interface SortableStaffRowProps {
  staff: { id: string; name: string };
  days: string[];
  startDate: Date;
  shiftsByStaffAndDay: Record<string, ShiftAssignment[]>;
  staffAvailability?: StaffAvailability;
  staffPreferredTimes?: StaffPreferredTime[];
  totalHours: number;
  onShiftClick?: (shift: ShiftAssignment) => void;
  onDayClick?: (staffId: string, date: string) => void;
}

function SortableStaffRow({
  staff,
  days,
  startDate,
  shiftsByStaffAndDay,
  staffAvailability,
  staffPreferredTimes,
  totalHours,
  onShiftClick,
  onDayClick,
}: SortableStaffRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: staff.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Convert time string (HH:MM) to hour decimal for positioning
  const timeToHours = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + minutes / 60;
  };

  // Calculate shift block position and width
  const getShiftStyle = (start: string, end: string) => {
    const startHour = timeToHours(start);
    const endHour = timeToHours(end);
    // Handle overnight shifts: if end time is before start time, add 24 hours
    const duration = endHour < startHour ? (endHour + 24) - startHour : endHour - startHour;

    // Position as percentage of 24-hour day
    const left = (startHour / 24) * 100;
    const width = (duration / 24) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  // Format time for display (convert 24h to 12h with am/pm)
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    if (hours === 0) return `12:${minutes.toString().padStart(2, '0')}am`;
    if (hours === 12) return `12:${minutes.toString().padStart(2, '0')}pm`;
    if (hours < 12) return `${hours}:${minutes.toString().padStart(2, '0')}am`;
    return `${hours - 12}:${minutes.toString().padStart(2, '0')}pm`;
  };

  // Get unavailable blocks for a specific day (Homebase-style)
  const getUnavailableBlocks = (dayOfWeek: string, dayDate: string) => {
    if (!staffAvailability) return [];

    const blocks: Array<{ start: number; end: number; reason?: string; isTimeOff?: boolean }> = [];

    // Add weekly recurring unavailability
    const weeklyUnavail = staffAvailability.weekly_availability.filter(
      (a) => a.day_of_week === dayOfWeek && a.status === 'unavailable'
    );
    weeklyUnavail.forEach((a) => {
      blocks.push({ start: a.hour_start, end: a.hour_end });
    });

    // Add one-time time-off for this specific date
    const timeOff = staffAvailability.time_off.filter((t) => t.date === dayDate);
    timeOff.forEach((t) => {
      const [startHour] = t.time_start.split(':').map(Number);
      const [endHour] = t.time_end.split(':').map(Number);
      blocks.push({
        start: startHour,
        end: endHour === 0 ? 24 : endHour,
        reason: t.reason,
        isTimeOff: true
      });
    });

    return blocks;
  };

  // Format hour to 12-hour format for display in blocks (e.g., "7pm-11:55pm")
  const formatBlockTime = (startHour: number, endHour: number): string => {
    const isFullDay = startHour === 0 && endHour === 24;
    if (isFullDay) return 'all day';

    const formatHour = (hour: number): string => {
      if (hour === 0) return '12am';
      if (hour === 12) return '12pm';
      if (hour < 12) return `${hour}am`;
      return `${hour - 12}pm`;
    };

    return `${formatHour(startHour)}-${formatHour(endHour)}`;
  };

  // Get preferred times for a specific day
  const getPreferredTimesForDay = (dayOfWeek: string): StaffPreferredTime[] => {
    if (!staffPreferredTimes) return [];
    return staffPreferredTimes.filter(
      (pref) => pref.day_of_week === dayOfWeek
    );
  };

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="grid grid-cols-8 gap-0">
        {/* Staff Name Cell (Draggable) */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/30 border-r min-w-0">
          <div {...attributes} {...listeners} className="cursor-move shrink-0">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-bold text-sm text-[#1e0b3a] truncate">{staff.name}</span>
            <span className="text-xs font-medium text-[#605f56] truncate">
              {totalHours.toFixed(2)} hrs
            </span>
          </div>
        </div>

        {/* Day Cells */}
        {days.map((day, dayIndex) => {
          const key = `${staff.id}-${day}`;
          const dayShifts = shiftsByStaffAndDay[key] || [];
          const dayDate = format(addDays(startDate, dayIndex), 'yyyy-MM-dd');
          const unavailableBlocks = getUnavailableBlocks(day, dayDate);
          const preferredTimes = getPreferredTimesForDay(day);

          // Build tooltip text for preferred times
          const preferredTimesTooltip = preferredTimes.length > 0
            ? `Preferred times:\n${preferredTimes.map(pref => formatBlockTime(pref.hour_start, pref.hour_end)).join('\n')}`
            : '';

          return (
            <div
              key={day}
              className="relative min-h-[48px] border-r last:border-r-0 hover:bg-accent/30 cursor-pointer transition-colors p-1"
              onClick={() => onDayClick?.(staff.id, dayDate)}
              title={preferredTimesTooltip}
            >
              {/* Unavailable/Time-off/Shift Blocks - Homebase exact styling */}
              <div className="flex flex-col gap-1 relative z-10">
                {/* Unavailable and Time-off blocks */}
                {unavailableBlocks.map((block, blockIndex) => {
                  const timeLabel = formatBlockTime(block.start, block.end);

                  return (
                    <div
                      key={`unavail-${blockIndex}`}
                      className={cn(
                        "rounded px-2 py-0.5 cursor-pointer hover:opacity-90 transition-opacity flex flex-col justify-center min-h-[36px]",
                        block.isTimeOff ? "bg-[#e6e4d6]" : "bg-[#f2f2ec]"
                      )}
                      title={block.isTimeOff ? `Time off: ${block.reason || 'Unavailable'}` : `Unavailable ${timeLabel}`}
                      onClick={(e) => {
                        // Allow click to create shift over unavailable time
                        onDayClick?.(staff.id, dayDate);
                      }}
                    >
                      {/* Label row with icon for time-off */}
                      <div className="flex items-center gap-1">
                        {block.isTimeOff && (
                          <svg className="w-3 h-3 text-[#605f56]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12c0 6.628-5.372 12-12 12S0 18.628 0 12 5.372 0 12 0s12 5.372 12 12ZM4.664 6.787A8.94 8.94 0 0 0 3 12c0 4.969 3.99 9 9 9a8.923 8.923 0 0 0 5.212-1.664L4.664 6.788ZM21 12c0-5.01-4.031-9-9-9a8.94 8.94 0 0 0-5.213 1.664l12.549 12.549A8.923 8.923 0 0 0 21 12Z" />
                          </svg>
                        )}
                        <div className="text-xs font-bold text-[#1e0b3a] leading-tight">
                          {block.isTimeOff ? 'Time-off' : 'Unavailable'}
                        </div>
                      </div>
                      {/* Time label */}
                      <div className="text-xs font-medium text-[#1e0b3a] leading-tight capitalize">
                        {timeLabel}
                      </div>
                    </div>
                  );
                })}

                {/* Shift Blocks - Homebase style */}
                {dayShifts.map((shift, shiftIndex) => {
                  const roleColor =
                    ROLE_COLORS[shift.role_required.toLowerCase() as keyof typeof ROLE_COLORS] ||
                    'bg-gray-400';

                  return (
                    <div
                      key={`shift-${shiftIndex}`}
                      className={cn(
                        'rounded px-2 py-0.5 cursor-pointer hover:opacity-90 transition-opacity flex flex-col justify-center min-h-[36px]',
                        roleColor,
                        shift.has_violation && 'ring-2 ring-red-500'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onShiftClick?.(shift);
                      }}
                    >
                      {/* Time - bold, 12px */}
                      <div className="text-xs font-bold text-[#1e0b3a] leading-tight">
                        {formatTime(shift.scheduled_start)}-{formatTime(shift.scheduled_end)}
                      </div>
                      {/* Role - medium weight, 12px */}
                      <div className="text-xs font-medium text-[#1e0b3a] leading-tight">
                        {shift.role_required}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty state - show chevron on hover */}
              {dayShifts.length === 0 && unavailableBlocks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function RosterWeeklyStaffView({
  weekStart,
  shifts,
  staffMembers,
  availability = [],
  preferredTimes = [],
  onShiftClick,
  onDayClick,
  onDayHeaderClick,
  className,
}: RosterWeeklyStaffViewProps) {
  const [staffOrder, setStaffOrder] = useState(staffMembers);
  const startDate = parse(weekStart, 'yyyy-MM-dd', new Date());

  // Create availability lookup by staff_id
  const availabilityByStaffId = availability.reduce((acc, avail) => {
    acc[avail.staff_id] = avail;
    return acc;
  }, {} as Record<string, StaffAvailability>);

  // Create preferred times lookup by staff_id
  const preferredTimesByStaffId = preferredTimes.reduce((acc, pref) => {
    if (!acc[pref.staff_id]) {
      acc[pref.staff_id] = [];
    }
    acc[pref.staff_id].push(pref);
    return acc;
  }, {} as Record<string, StaffPreferredTime[]>);

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStaffOrder((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Group shifts by staff and day
  const shiftsByStaffAndDay = shifts.reduce((acc, shift) => {
    const key = `${shift.staff_id}-${shift.day_of_week}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(shift);
    return acc;
  }, {} as Record<string, ShiftAssignment[]>);

  // Calculate total hours per staff member
  const calculateStaffHours = (staffId: string): number => {
    const staffShifts = shifts.filter((s) => s.staff_id === staffId);
    return staffShifts.reduce((total, shift) => {
      const [startHour, startMin] = shift.scheduled_start.split(':').map(Number);
      const [endHour, endMin] = shift.scheduled_end.split(':').map(Number);
      const start = startHour + startMin / 60;
      const end = endHour + endMin / 60;
      // Handle overnight shifts: if end time is before start time, add 24 hours
      const duration = end < start ? (end + 24) - start : end - start;
      return total + duration;
    }, 0);
  };

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[1200px]">
        {/* Header Row - Homebase style */}
        <div className="grid grid-cols-8 gap-0 mb-1 border-b pb-2">
          {/* Staff Names Column Header */}
          <div className="font-bold text-sm text-[#1e0b3a] px-4 py-2">
            Staff
          </div>

          {/* Day Headers - Click to open Gantt view */}
          {DAYS_OF_WEEK.map((day, index) => {
            const dayDate = addDays(startDate, index);
            const dayDateStr = format(dayDate, 'yyyy-MM-dd');
            const isToday = dayDateStr === format(new Date(), 'yyyy-MM-dd');
            return (
              <div
                key={day}
                className="text-center px-2 cursor-pointer hover:bg-accent/50 transition-colors rounded"
                onClick={() => onDayHeaderClick?.(dayDateStr)}
              >
                <div className={cn(
                  "font-semibold text-sm py-1",
                  isToday && "text-purple-600"
                )}>
                  {day.substring(0, 3)}, {format(dayDate, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Draggable Staff Rows */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={staffOrder.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {staffOrder.map((staff) => (
                <SortableStaffRow
                  key={staff.id}
                  staff={staff}
                  days={DAYS_OF_WEEK}
                  startDate={startDate}
                  shiftsByStaffAndDay={shiftsByStaffAndDay}
                  staffAvailability={availabilityByStaffId[staff.id]}
                  staffPreferredTimes={preferredTimesByStaffId[staff.id]}
                  totalHours={calculateStaffHours(staff.id)}
                  onShiftClick={onShiftClick}
                  onDayClick={onDayClick}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Legend - Homebase colors */}
        <div className="mt-4 flex items-center gap-4 text-xs text-[#605f56]">
          <span className="font-semibold text-[#1e0b3a]">Roles:</span>
          <div className="flex items-center gap-2">
            <div className={cn('w-4 h-4 rounded', ROLE_COLORS.supervisor)} />
            <span>Supervisor</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-4 h-4 rounded', ROLE_COLORS.dealer)} />
            <span>Dealer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-4 h-4 rounded', ROLE_COLORS.senior)} />
            <span>Senior</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-4 h-4 rounded', ROLE_COLORS.barista)} />
            <span>Barista</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-4 h-4 rounded', ROLE_COLORS['game master'])} />
            <span>Game Master</span>
          </div>
        </div>
      </div>
    </div>
  );
}
