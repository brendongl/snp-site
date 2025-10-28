'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface VideoGameFiltersProps {
  onFilterChange: (filters: {
    locatedOn: string[];
    category: string[];
    ageRating: number[];
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

export default function VideoGameFilters({
  onFilterChange,
  availableLocations,
  availableCategories,
}: VideoGameFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAgeRatings, setSelectedAgeRatings] = useState<number[]>([]);

  const handleLocationToggle = (location: string) => {
    const updated = selectedLocations.includes(location)
      ? selectedLocations.filter((l) => l !== location)
      : [...selectedLocations, location];

    setSelectedLocations(updated);
    onFilterChange({ locatedOn: updated, category: selectedCategories, ageRating: selectedAgeRatings });
  };

  const handleCategoryToggle = (category: string) => {
    const updated = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];

    setSelectedCategories(updated);
    onFilterChange({ locatedOn: selectedLocations, category: updated, ageRating: selectedAgeRatings });
  };

  const handleAgeRatingToggle = (rating: number) => {
    const updated = selectedAgeRatings.includes(rating)
      ? selectedAgeRatings.filter((r) => r !== rating)
      : [...selectedAgeRatings, rating];

    setSelectedAgeRatings(updated);
    onFilterChange({ locatedOn: selectedLocations, category: selectedCategories, ageRating: updated });
  };

  const handleClearFilters = () => {
    setSelectedLocations([]);
    setSelectedCategories([]);
    setSelectedAgeRatings([]);
    onFilterChange({ locatedOn: [], category: [], ageRating: [] });
  };

  const hasActiveFilters = selectedLocations.length > 0 || selectedCategories.length > 0 || selectedAgeRatings.length > 0;

  return (
    <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold">Filters</span>
          {hasActiveFilters && (
            <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
              {selectedLocations.length + selectedCategories.length + selectedAgeRatings.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Console Location Filter */}
          {availableLocations.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-3">Console Location</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableLocations.map((location) => (
                  <label
                    key={location}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
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

          {/* Genre Filter */}
          {availableCategories.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-3">Genre</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {availableCategories.map((category) => (
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
  );
}
