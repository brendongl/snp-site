'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameFilters } from '@/types';

interface AdvancedFiltersProps {
  open: boolean;
  onClose: () => void;
  filters: GameFilters;
  onApplyFilters: (filters: GameFilters) => void;
  availableCategories: string[];
}

export function AdvancedFilters({
  open,
  onClose,
  filters,
  onApplyFilters,
  availableCategories
}: AdvancedFiltersProps) {
  const [localFilters, setLocalFilters] = useState<GameFilters>(filters);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters: GameFilters = {
      search: '',
      quickFilter: undefined,
      categoryMatchMode: 'OR',
    };
    setLocalFilters(resetFilters);
    onApplyFilters(resetFilters);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto px-6">
        <SheetHeader>
          <SheetTitle>Advanced Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6 pb-6">
          {/* Best Player Count */}
          <div className="space-y-3">
            <Label>Best Player Count</Label>
            <Select
              value={localFilters.bestPlayerCount?.toString() || "any"}
              onValueChange={(value) => setLocalFilters({
                ...localFilters,
                bestPlayerCount: value === "any" ? undefined : Number(value)
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="1">1 Player</SelectItem>
                <SelectItem value="2">2 Players</SelectItem>
                <SelectItem value="3">3 Players</SelectItem>
                <SelectItem value="4">4 Players</SelectItem>
                <SelectItem value="5">5 Players</SelectItem>
                <SelectItem value="6">6 Players</SelectItem>
                <SelectItem value="7">7 Players</SelectItem>
                <SelectItem value="8">8+ Players</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Player Count Range */}
          <div className="space-y-3">
            <Label>Number of Players (Range)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minPlayers" className="text-sm text-muted-foreground">
                  Min Players
                </Label>
                <Select
                  value={localFilters.playerCount?.min?.toString()}
                  onValueChange={(value) => setLocalFilters({
                    ...localFilters,
                    playerCount: {
                      ...localFilters.playerCount,
                      min: value ? Number(value) : undefined
                    }
                  })}
                >
                  <SelectTrigger id="minPlayers">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxPlayers" className="text-sm text-muted-foreground">
                  Max Players
                </Label>
                <Select
                  value={localFilters.playerCount?.max?.toString()}
                  onValueChange={(value) => setLocalFilters({
                    ...localFilters,
                    playerCount: {
                      ...localFilters.playerCount,
                      max: value ? Number(value) : undefined
                    }
                  })}
                >
                  <SelectTrigger id="maxPlayers">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="6">6</SelectItem>
                    <SelectItem value="7">7</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="17">17</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Year Range */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Year Released</Label>
              <span className="text-sm text-muted-foreground">
                {localFilters.yearRange?.min || 1900} - {localFilters.yearRange?.max || new Date().getFullYear()}
              </span>
            </div>
            <Slider
              min={1900}
              max={new Date().getFullYear()}
              step={1}
              value={[
                localFilters.yearRange?.min || 1900,
                localFilters.yearRange?.max || new Date().getFullYear()
              ]}
              onValueChange={(values) => setLocalFilters({
                ...localFilters,
                yearRange: {
                  min: values[0],
                  max: values[1]
                }
              })}
              className="py-4"
            />
          </div>

          {/* Complexity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Complexity / Difficulty</Label>
              <span className="text-sm text-muted-foreground">
                {localFilters.complexity?.min || 1} - {localFilters.complexity?.max || 5}
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[
                localFilters.complexity?.min || 1,
                localFilters.complexity?.max || 5
              ]}
              onValueChange={(values) => setLocalFilters({
                ...localFilters,
                complexity: {
                  min: values[0],
                  max: values[1]
                }
              })}
              className="py-4"
            />
          </div>

          {/* Playtime */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Playtime</Label>
              <span className="text-sm text-muted-foreground">
                {localFilters.playtime
                  ? `${localFilters.playtime} min`
                  : 'Any'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Show games that can be played in this time
            </p>
            <Slider
              min={15}
              max={300}
              step={15}
              value={[localFilters.playtime || 150]}
              onValueChange={(values) => setLocalFilters({
                ...localFilters,
                playtime: values[0]
              })}
              className="py-4"
            />
            {localFilters.playtime && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalFilters({
                  ...localFilters,
                  playtime: undefined
                })}
                className="text-xs"
              >
                Clear playtime filter
              </Button>
            )}
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Categories (Max 3)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Match:</span>
                <Select
                  value={localFilters.categoryMatchMode || 'OR'}
                  onValueChange={(value: 'AND' | 'OR') => setLocalFilters({
                    ...localFilters,
                    categoryMatchMode: value
                  })}
                >
                  <SelectTrigger className="w-[80px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OR">ANY</SelectItem>
                    <SelectItem value="AND">ALL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Popular Categories - Quick Select */}
            <div className="flex flex-wrap gap-2">
              {['Card Game', 'Deduction', 'Party', 'Family', 'Strategy'].map((category) => {
                const isSelected = localFilters.categories?.includes(category);
                const isDisabled = !isSelected && (localFilters.categories?.length || 0) >= 3;
                return (
                  <Button
                    key={category}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    disabled={isDisabled}
                    onClick={() => {
                      const currentCategories = localFilters.categories || [];
                      const newCategories = isSelected
                        ? currentCategories.filter(c => c !== category)
                        : [...currentCategories, category];
                      setLocalFilters({
                        ...localFilters,
                        categories: newCategories.length > 0 ? newCategories : undefined
                      });
                    }}
                  >
                    {category}
                  </Button>
                );
              })}
            </div>

            {/* All Categories Dropdown */}
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryOpen}
                  className="w-full justify-between"
                >
                  {localFilters.categories && localFilters.categories.length > 0
                    ? `${localFilters.categories.length}/3 selected`
                    : "Select categories..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search categories..." />
                  <CommandList>
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup>
                      {availableCategories.map((category) => {
                        const isSelected = localFilters.categories?.includes(category);
                        const isDisabled = !isSelected && (localFilters.categories?.length || 0) >= 3;
                        return (
                          <CommandItem
                            key={category}
                            value={category}
                            disabled={isDisabled}
                            onSelect={() => {
                              if (isDisabled) return;
                              const currentCategories = localFilters.categories || [];
                              const newCategories = isSelected
                                ? currentCategories.filter(c => c !== category)
                                : [...currentCategories, category];
                              setLocalFilters({
                                ...localFilters,
                                categories: newCategories.length > 0 ? newCategories : undefined
                              });
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {category}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {localFilters.categories && localFilters.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {localFilters.categories.map((category) => (
                  <span key={category} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                    {category}
                    <button
                      type="button"
                      onClick={() => {
                        const newCategories = localFilters.categories!.filter(c => c !== category);
                        setLocalFilters({
                          ...localFilters,
                          categories: newCategories.length > 0 ? newCategories : undefined
                        });
                      }}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleApply} className="flex-1">
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
