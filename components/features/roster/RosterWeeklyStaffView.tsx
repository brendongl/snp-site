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
  onDayClick?: (staffId: string, date: string) => void;
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

// Role color mapping (simplified - no shift type labels)
const ROLE_COLORS = {
  cafe: 'bg-blue-500',
  floor: 'bg-purple-500',
  opening: 'bg-green-500',
  closing: 'bg-red-500',
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
      <div className="grid grid-cols-8 gap-1">
        {/* Staff Name Cell (Draggable) */}
        <div className="flex items-center gap-1 px-2 py-2 bg-muted/50 border-r">
          <div {...attributes} {...listeners} className="cursor-move">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-xs truncate">{staff.name}</span>
            <span className="text-[10px] text-muted-foreground">
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
              className="relative h-14 border-r last:border-r-0 hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => onDayClick?.(staff.id, dayDate)}
            >
              {/* Shift Blocks */}
              {dayShifts.map((shift, shiftIndex) => {
                const style = getShiftStyle(
                  shift.scheduled_start,
                  shift.scheduled_end
                );
                const roleColor =
                  ROLE_COLORS[shift.role_required as keyof typeof ROLE_COLORS] ||
                  'bg-gray-500';

                return (
                  <div
                    key={shiftIndex}
                    className={cn(
                      'absolute top-1 h-12 rounded flex items-center justify-center text-white text-[10px] font-medium cursor-pointer hover:opacity-80 transition-opacity',
                      roleColor,
                      shift.has_violation && 'ring-1 ring-red-500'
                    )}
                    style={style}
                    onClick={(e) => {
                      e.stopPropagation();
                      onShiftClick?.(shift);
                    }}
                  >
                    <span className="truncate px-0.5">
                      {formatTime(shift.scheduled_start)}-{formatTime(shift.scheduled_end)}
                    </span>
                  </div>
                );
              })}

              {/* Empty state - show chevron on hover */}
              {dayShifts.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
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
        {/* Header Row */}
        <div className="grid grid-cols-8 gap-2 mb-2">
          {/* Staff Names Column Header */}
          <div className="font-semibold text-sm text-muted-foreground px-4 py-2">
            Staff
          </div>

          {/* Day Headers */}
          {DAYS_OF_WEEK.map((day, index) => {
            const dayDate = addDays(startDate, index);
            return (
              <div key={day} className="text-center">
                <div className="font-semibold text-sm">{day}</div>
                <div className="text-xs text-muted-foreground">
                  {format(dayDate, 'MMM d')}
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
            <div className="space-y-0.5">
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

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-medium">Roles:</span>
          <div className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', ROLE_COLORS.cafe)} />
            <span>Cafe</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', ROLE_COLORS.floor)} />
            <span>Floor</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', ROLE_COLORS.opening)} />
            <span>Opening</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', ROLE_COLORS.closing)} />
            <span>Closing</span>
          </div>
        </div>
      </div>
    </div>
  );
}
