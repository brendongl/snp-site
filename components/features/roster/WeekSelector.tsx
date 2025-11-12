'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, addWeeks, subWeeks, startOfWeek, parse } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface WeekSelectorProps {
  selectedWeek: string; // ISO date string (YYYY-MM-DD) of Monday
  onChange: (weekStart: string) => void;
  minWeek?: string;
  maxWeek?: string;
  className?: string;
}

export function WeekSelector({
  selectedWeek,
  onChange,
  minWeek,
  maxWeek,
  className,
}: WeekSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse selected week to Date object
  const selectedDate = parse(selectedWeek, 'yyyy-MM-dd', new Date());

  // Helper to ensure date is Monday
  const getMonday = (date: Date) => {
    return startOfWeek(date, { weekStartsOn: 1 }); // 1 = Monday
  };

  // Navigation handlers
  const handlePreviousWeek = () => {
    const newWeek = subWeeks(selectedDate, 1);
    onChange(format(newWeek, 'yyyy-MM-dd'));
  };

  const handleNextWeek = () => {
    const newWeek = addWeeks(selectedDate, 1);
    onChange(format(newWeek, 'yyyy-MM-dd'));
  };

  // Calendar selection handler
  const handleSelect = (date: Date | undefined) => {
    if (!date) return;

    // Ensure we select the Monday of the week
    const monday = getMonday(date);
    onChange(format(monday, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  // Check if navigation buttons should be disabled
  const isPreviousDisabled = minWeek
    ? selectedWeek <= minWeek
    : false;

  const isNextDisabled = maxWeek
    ? selectedWeek >= maxWeek
    : false;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousWeek}
        disabled={isPreviousDisabled}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[240px] justify-start text-left font-normal',
              !selectedWeek && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedWeek ? (
              <span>
                Week of {format(selectedDate, 'MMM d, yyyy')}
              </span>
            ) : (
              <span>Pick a week</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            disabled={(date) => {
              // Disable dates outside min/max range
              if (minWeek && format(date, 'yyyy-MM-dd') < minWeek) return true;
              if (maxWeek && format(date, 'yyyy-MM-dd') > maxWeek) return true;
              return false;
            }}
          />
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNextWeek}
        disabled={isNextDisabled}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
