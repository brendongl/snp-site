'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, Users, Heart, UsersRound, X, Sparkles, Info, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GameFilters as FilterType } from '@/types';

interface GameFiltersProps {
  filters: FilterType;
  onQuickFilter: (filter: 'sixPlus' | 'couples' | 'social' | 'noChecks' | 'hasIssues' | null) => void;
  onOpenAdvancedFilter: () => void;
  onClearAll: () => void;
  activeFiltersCount: number;
  hasAnyFilters: boolean;
  isStaff?: boolean;
}

export function GameFilters({
  filters,
  onQuickFilter,
  onOpenAdvancedFilter,
  onClearAll,
  activeFiltersCount,
  hasAnyFilters,
  isStaff = false
}: GameFiltersProps) {
  const getSpecialFilterLabel = () => {
    if (filters.quickFilter === 'sixPlus') return '6+ Players';
    if (filters.quickFilter === 'couples') return 'Couples';
    if (filters.quickFilter === 'social') return 'Social';
    if (filters.quickFilter === 'noChecks') return 'Games w/ No Checks';
    if (filters.quickFilter === 'hasIssues') return 'Has Issues'; // v1.2.0
    return 'None';
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {isStaff && (
          // Staff mode: Separate row for special filters dropdown
          <div className="flex items-center gap-2 pb-2 border-b border-border/50">
            <span className="text-sm font-medium text-muted-foreground">Special Filters:</span>
            <Select
              value={filters.quickFilter || 'none'}
              onValueChange={(value) => {
                if (value === 'none') {
                  onQuickFilter(null);
                } else {
                  onQuickFilter(value as 'sixPlus' | 'couples' | 'social' | 'noChecks' | 'hasIssues');
                }
              }}
            >
              <SelectTrigger className="w-[180px] bg-primary/5 border-primary/20">
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                <SelectValue placeholder="Special Filters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sixPlus">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    6+ Players
                  </div>
                </SelectItem>
                <SelectItem value="couples">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Couples
                  </div>
                </SelectItem>
                <SelectItem value="social">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    Social
                  </div>
                </SelectItem>
                <SelectItem value="noChecks">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Games w/ No Checks
                  </div>
                </SelectItem>
                <SelectItem value="hasIssues">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Has Issues
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isStaff && (
            // Non-staff mode: Show individual buttons with tooltips
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={filters.quickFilter === 'sixPlus' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onQuickFilter(filters.quickFilter === 'sixPlus' ? null : 'sixPlus')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    6+ Players
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Games that support 6 or more players</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={filters.quickFilter === 'couples' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onQuickFilter(filters.quickFilter === 'couples' ? null : 'couples')}
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    Couples
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Games for exactly 2 players or best at 2 players</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={filters.quickFilter === 'social' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onQuickFilter(filters.quickFilter === 'social' ? null : 'social')}
                  >
                    <UsersRound className="mr-2 h-4 w-4" />
                    Social
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Party, Deduction, or Social games for 2+ players</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenAdvancedFilter}
          className="relative"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {hasAnyFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        )}
        </div>
      </div>
    </TooltipProvider>
  );
}