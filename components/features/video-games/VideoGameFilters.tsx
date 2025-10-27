'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

interface VideoGameFiltersProps {
  onFilterChange: (filters: {
    locatedOn: string[];
    category: string[];
  }) => void;
  availableLocations: string[];
  availableCategories: string[];
}

export default function VideoGameFilters({
  onFilterChange,
  availableLocations,
  availableCategories,
}: VideoGameFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleLocationToggle = (location: string) => {
    const updated = selectedLocations.includes(location)
      ? selectedLocations.filter((l) => l !== location)
      : [...selectedLocations, location];

    setSelectedLocations(updated);
    onFilterChange({ locatedOn: updated, category: selectedCategories });
  };

  const handleCategoryToggle = (category: string) => {
    const updated = selectedCategories.includes(category)
      ? selectedCategories.filter((c) => c !== category)
      : [...selectedCategories, category];

    setSelectedCategories(updated);
    onFilterChange({ locatedOn: selectedLocations, category: updated });
  };

  const handleClearFilters = () => {
    setSelectedLocations([]);
    setSelectedCategories([]);
    onFilterChange({ locatedOn: [], category: [] });
  };

  const hasActiveFilters = selectedLocations.length > 0 || selectedCategories.length > 0;

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
              {selectedLocations.length + selectedCategories.length}
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
