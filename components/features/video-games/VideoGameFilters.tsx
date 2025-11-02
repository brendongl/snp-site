'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, MapPin } from 'lucide-react';

interface VideoGameFiltersProps {
  onFilterChange: (filters: {
    locatedOn: string[];
    category: string[];
    ageRating: number[];
    playerCount: number[];
    quickFilter: '4-player' | '8-player' | null;
    locationFilterMode: 'OR' | 'AND';
  }) => void;
  availableLocations: string[];
  availableCategories: string[];
}

const AGE_RATINGS = [
  { value: 6, label: 'E (Everyone)', description: 'Ages 6+' },
  { value: 10, label: 'E10+ (Everyone 10+)', description: 'Ages 10+' },
  { value: 13, label: 'T (Teen)', description: 'Ages 13+' },
  { value: 17, label: 'M (Mature)', description: 'Ages 17+' },
];

const PLAYER_COUNTS = [
  { value: 1, label: '1 Player', description: 'Single player only' },
  { value: 2, label: '2 Players', description: '2 players' },
  { value: 3, label: '3 Players', description: '3 players' },
  { value: 4, label: '4 Players', description: '4 players' },
  { value: 5, label: '5-6 Players', description: '5-6 players' },
  { value: 7, label: '7-8 Players', description: '7-8 players' },
];

export default function VideoGameFilters({
  onFilterChange,
  availableLocations,
  availableCategories,
}: VideoGameFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAgeRatings, setSelectedAgeRatings] = useState<number[]>([]);
  const [selectedPlayerCounts, setSelectedPlayerCounts] = useState<number[]>([]);
  const [quickFilter, setQuickFilter] = useState<'4-player' | '8-player' | null>(null);
  const [locationFilterMode, setLocationFilterMode] = useState<'OR' | 'AND'>('OR');

  // Filter out non-English genres
  const englishCategories = useMemo(() => {
    return availableCategories.filter(category => {
      // Filter out non-Latin characters (non-English genres)
      const hasNonLatinChars = /[^\x00-\x7F]/.test(category);
      return !hasNonLatinChars;
    });
  }, [availableCategories]);

  const handleLocationToggle = (location: string) => {
    const updated = selectedLocations.includes(location)
      ? selectedLocations.filter((l) => l !== location)
      : [...selectedLocations, location];

    setSelectedLocations(updated);
    onFilterChange({ locatedOn: updated, category: selectedCategories, ageRating: selectedAgeRatings, playerCount: selectedPlayerCounts, quickFilter, locationFilterMode });
  };

  const handleCategoryToggle = (category: string) => {
    const updated = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];

    setSelectedCategories(updated);
    onFilterChange({ locatedOn: selectedLocations, category: updated, ageRating: selectedAgeRatings, playerCount: selectedPlayerCounts, quickFilter, locationFilterMode });
  };

  const handleAgeRatingToggle = (rating: number) => {
    const updated = selectedAgeRatings.includes(rating)
      ? selectedAgeRatings.filter((r) => r !== rating)
      : [...selectedAgeRatings, rating];

    setSelectedAgeRatings(updated);
    onFilterChange({ locatedOn: selectedLocations, category: selectedCategories, ageRating: updated, playerCount: selectedPlayerCounts, quickFilter, locationFilterMode });
  };

  const handlePlayerCountToggle = (count: number) => {
    const updated = selectedPlayerCounts.includes(count)
      ? selectedPlayerCounts.filter((c) => c !== count)
      : [...selectedPlayerCounts, count];

    setSelectedPlayerCounts(updated);
    onFilterChange({ locatedOn: selectedLocations, category: selectedCategories, ageRating: selectedAgeRatings, playerCount: updated, quickFilter, locationFilterMode });
  };

  const handleQuickFilterToggle = (filter: '4-player' | '8-player') => {
    const newQuickFilter = quickFilter === filter ? null : filter;
    setQuickFilter(newQuickFilter);
    onFilterChange({ locatedOn: selectedLocations, category: selectedCategories, ageRating: selectedAgeRatings, playerCount: selectedPlayerCounts, quickFilter: newQuickFilter, locationFilterMode });
  };

  const handleLocationFilterModeToggle = () => {
    const newMode = locationFilterMode === 'OR' ? 'AND' : 'OR';
    setLocationFilterMode(newMode);
    onFilterChange({ locatedOn: selectedLocations, category: selectedCategories, ageRating: selectedAgeRatings, playerCount: selectedPlayerCounts, quickFilter, locationFilterMode: newMode });
  };

  const handleClearFilters = () => {
    setSelectedLocations([]);
    setSelectedCategories([]);
    setSelectedAgeRatings([]);
    setSelectedPlayerCounts([]);
    setQuickFilter(null);
    setLocationFilterMode('OR');
    onFilterChange({ locatedOn: [], category: [], ageRating: [], playerCount: [], quickFilter: null, locationFilterMode: 'OR' });
  };

  const hasActiveFilters = selectedLocations.length > 0 || selectedCategories.length > 0 || selectedAgeRatings.length > 0 || selectedPlayerCounts.length > 0 || quickFilter !== null;

  return (
    <div className="mb-6 space-y-3">
      {/* Quick Filter Buttons - 4 Player & 8 Player */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleQuickFilterToggle('4-player')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            quickFilter === '4-player'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          🎮 Up to 4 Players
        </button>
        <button
          onClick={() => handleQuickFilterToggle('8-player')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            quickFilter === '8-player'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          🎮 Up to 8 Players
        </button>

        {/* Console Location Popup Button */}
        <div className="relative">
          <button
            onClick={() => setShowLocationPopup(!showLocationPopup)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
              selectedLocations.length > 0
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <MapPin size={16} />
            Console Location
            {selectedLocations.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">
                {selectedLocations.length}
              </span>
            )}
          </button>

          {/* Location Popup */}
          {showLocationPopup && (
            <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-10 min-w-[250px]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">Select Console</span>
                <button
                  onClick={() => setShowLocationPopup(false)}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              </div>

              {/* AND/OR Toggle */}
              {selectedLocations.length > 1 && (
                <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Filter Mode:</span>
                    <button
                      onClick={handleLocationFilterModeToggle}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                        locationFilterMode === 'OR'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {locationFilterMode === 'OR' ? 'ANY (OR)' : 'ALL (AND)'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {locationFilterMode === 'OR'
                      ? 'Show games on ANY selected console'
                      : 'Show games on ALL selected consoles'}
                  </p>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableLocations.map((location) => (
                  <label
                    key={location}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLocations.includes(location)}
                      onChange={() => handleLocationToggle(location)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{location}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Section */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Advanced Filters</span>
            {hasActiveFilters && (
              <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                {selectedLocations.length + selectedCategories.length + selectedAgeRatings.length + selectedPlayerCounts.length + (quickFilter ? 1 : 0)}
              </span>
            )}
          </div>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Genre Filter - English only */}
          {englishCategories.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-3">Genre</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {englishCategories.map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Player Count Filter */}
          <div>
            <label className="block text-sm font-semibold mb-3">Number of Players</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PLAYER_COUNTS.map((playerCount) => (
                <label
                  key={playerCount.value}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayerCounts.includes(playerCount.value)}
                    onChange={() => handlePlayerCountToggle(playerCount.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{playerCount.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Age Rating Filter */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              Age Rating (ESRB) - Age Appropriate Filter
            </label>
            <div className="space-y-2">
              {AGE_RATINGS.map((rating) => (
                <label
                  key={rating.value}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAgeRatings.includes(rating.value)}
                    onChange={() => handleAgeRatingToggle(rating.value)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{rating.label}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{rating.description}</div>
                  </div>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              💡 Tip: Select age ratings appropriate for your child. For example, select "E" and "E10+" for games suitable for a 6-year-old.
            </p>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-semibold"
            >
              <X size={16} />
              Clear all filters
            </button>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
