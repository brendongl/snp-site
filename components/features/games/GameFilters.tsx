'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, Users, Heart, PartyPopper } from 'lucide-react';
import { GameFilters as FilterType } from '@/types';

interface GameFiltersProps {
  filters: FilterType;
  onQuickFilter: (filter: 'sixPlus' | 'couples' | 'party' | null) => void;
  onOpenAdvancedFilter: () => void;
  activeFiltersCount: number;
}

export function GameFilters({
  filters,
  onQuickFilter,
  onOpenAdvancedFilter,
  activeFiltersCount
}: GameFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={filters.quickFilter === 'sixPlus' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onQuickFilter(filters.quickFilter === 'sixPlus' ? null : 'sixPlus')}
      >
        <Users className="mr-2 h-4 w-4" />
        6+ Players
      </Button>

      <Button
        variant={filters.quickFilter === 'couples' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onQuickFilter(filters.quickFilter === 'couples' ? null : 'couples')}
      >
        <Heart className="mr-2 h-4 w-4" />
        Couples
      </Button>

      <Button
        variant={filters.quickFilter === 'party' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onQuickFilter(filters.quickFilter === 'party' ? null : 'party')}
      >
        <PartyPopper className="mr-2 h-4 w-4" />
        Party
      </Button>

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
    </div>
  );
}