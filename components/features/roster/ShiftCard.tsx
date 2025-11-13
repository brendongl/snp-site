'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { Edit, Key, AlertTriangle } from 'lucide-react';

export interface ShiftAssignment {
  id?: string;
  staff_id: string;
  staff_name: string;
  day_of_week: string;
  shift_type: 'opening' | 'day' | 'evening' | 'closing';
  scheduled_start: string;
  scheduled_end: string;
  role_required: string;
  requires_keys?: boolean;
  has_violation?: boolean;
  violation_message?: string;
  is_published?: boolean;
  edited_after_publish?: boolean;
}

interface ShiftCardProps {
  shift: ShiftAssignment;
  onEdit?: () => void;
  onDelete?: () => void;
  showViolations?: boolean;
  editable?: boolean;
  className?: string;
}

// Color schemes for shift types (matching design doc)
const SHIFT_COLORS = {
  opening: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-700 dark:text-green-300',
    badgeBg: 'bg-green-500',
    icon: '🔑',
  },
  day: {
    border: 'border-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-500',
    icon: '☀️',
  },
  evening: {
    border: 'border-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    text: 'text-purple-700 dark:text-purple-300',
    badgeBg: 'bg-purple-500',
    icon: '🌙',
  },
  closing: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-300',
    badgeBg: 'bg-red-500',
    icon: '🔒',
  },
};

export function ShiftCard({
  shift,
  onEdit,
  onDelete,
  showViolations = true,
  editable = true,
  className,
}: ShiftCardProps) {
  const colors = SHIFT_COLORS[shift.shift_type];

  // Format times
  const formatTime = (time: string) => {
    try {
      const parsed = parse(time, 'HH:mm', new Date());
      return format(parsed, 'h:mma');
    } catch {
      return time;
    }
  };

  // Get staff initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if shift is unpublished or edited after publish
  const isUnpublished = shift.edited_after_publish || shift.is_published === false;

  return (
    <Card
      className={cn(
        'border-l-4 transition-all hover:shadow-md',
        colors.border,
        colors.bg,
        shift.has_violation && 'ring-2 ring-yellow-400',
        // Dotted border for unpublished edits (like Homebase)
        isUnpublished && 'border-2 border-dashed !border-blue-500',
        className
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Shift Type Badge */}
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className={cn(
              'font-semibold text-white',
              colors.badgeBg
            )}
          >
            {colors.icon} {shift.shift_type.charAt(0).toUpperCase() + shift.shift_type.slice(1)}
          </Badge>
          {shift.requires_keys && (
            <Key className="h-3 w-3 text-amber-600" />
          )}
        </div>

        {/* Time Range */}
        <div className={cn('text-sm font-medium', colors.text)}>
          {formatTime(shift.scheduled_start)} - {formatTime(shift.scheduled_end)}
        </div>

        {/* Staff Info */}
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white',
            colors.badgeBg
          )}>
            {getInitials(shift.staff_name)}
          </div>

          {/* Staff Name & Role */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{shift.staff_name}</div>
            <div className="text-xs text-muted-foreground capitalize">{shift.role_required}</div>
          </div>
        </div>

        {/* Violation Warning */}
        {showViolations && shift.has_violation && (
          <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 rounded text-xs">
            <AlertTriangle className="h-3 w-3 text-yellow-600 flex-shrink-0 mt-0.5" />
            <span className="text-yellow-700 dark:text-yellow-300">
              {shift.violation_message || 'Constraint violation'}
            </span>
          </div>
        )}

        {/* Actions */}
        {editable && onEdit && (
          <div className="flex gap-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-7 px-2 text-xs w-full"
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
