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

interface RosterWeeklyStaffViewProps {
  weekStart: string; // ISO date string (YYYY-MM-DD) of Monday
  shifts: ShiftAssignment[];
  staffMembers: Array<{ id: string; name: string }>;
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
  totalHours: number;
  onShiftClick?: (shift: ShiftAssignment) => void;
  onDayClick?: (staffId: string, date: string) => void;
}

function SortableStaffRow({
  staff,
  days,
  startDate,
  shiftsByStaffAndDay,
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
    const duration = endHour - startHour;

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

          return (
            <div
              key={day}
              className="relative min-h-[48px] border-r last:border-r-0 hover:bg-accent/30 cursor-pointer transition-colors p-1"
              onClick={() => onDayClick?.(staff.id, dayDate)}
            >
              {/* Shift Blocks - Homebase style */}
              <div className="flex flex-col gap-1">
                {dayShifts.map((shift, shiftIndex) => {
                  const roleColor =
                    ROLE_COLORS[shift.role_required.toLowerCase() as keyof typeof ROLE_COLORS] ||
                    'bg-gray-400';

                  return (
                    <div
                      key={shiftIndex}
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
              {dayShifts.length === 0 && (
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
  onShiftClick,
  onDayClick,
  onDayHeaderClick,
  className,
}: RosterWeeklyStaffViewProps) {
  const [staffOrder, setStaffOrder] = useState(staffMembers);
  const startDate = parse(weekStart, 'yyyy-MM-dd', new Date());

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
      return total + (end - start);
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
