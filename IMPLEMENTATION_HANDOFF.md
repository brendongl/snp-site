# Nintendo Switch Video Games Gallery - Implementation Handoff

**Date:** January 27, 2025
**Project:** Video Games Gallery (Phase 1 - Nintendo Switch)
**Status:** Backend Complete - Frontend Components Needed
**Deadline:** COMPLETE ALL TASKS - DO NOT STOP UNTIL FINISHED

---

## ⚠️ CRITICAL INSTRUCTIONS FOR IMPLEMENTING AGENT

**YOU MUST COMPLETE THIS ENTIRE IMPLEMENTATION IN ONE SESSION.**

- **DO NOT STOP** until all tasks are completed successfully
- **DO NOT LEAVE** partial implementations
- **DO NOT SKIP** any components or features
- **ONLY STOP** if you encounter a major blocker that cannot be resolved (database connection failure, missing critical dependencies, etc.)
- If you encounter minor issues (TypeScript errors, styling tweaks, etc.), **FIX THEM** and continue
- After completing each task, mark it as complete in the checklist
- Test each component as you build it
- Follow the existing code patterns exactly as shown in the reference files

**Success Criteria:** All checkboxes checked, all files created, build succeeds without errors, gallery displays games.

---

## 📋 Project Overview

### Goal
Create a public video games gallery at `/video-games` displaying Nintendo Switch games from 6 physical consoles (Samus, Toad, Yoshi, Fox, LMac, Wolf). The architecture is future-proof for PS5, Xbox, and other platforms.

### What's Been Completed ✅

**Backend Infrastructure (100% Complete):**
1. ✅ Design documentation: `docs/plans/2025-01-27-switch-video-games-gallery-design.md`
2. ✅ Database schema script: `scripts/create-video-games-table.js`
3. ✅ TypeScript types: `types/index.ts` (VideoGame, VideoGameFilters, VideogamePlatform)
4. ✅ Image service: `lib/services/video-game-images-service.ts`
5. ✅ Database service: `lib/services/video-games-db-service.ts`
6. ✅ Migration script: `scripts/migrate-switch-games.js`
7. ✅ API endpoints:
   - `app/api/video-games/route.ts`
   - `app/api/video-games/[id]/route.ts`
   - `app/api/video-games/images/[titleId]/route.ts`

### What Needs to Be Done 🔨

**Frontend Components (0% Complete - YOUR RESPONSIBILITY):**
1. ⬜ VideoGameCard component
2. ⬜ VideoGameModal component
3. ⬜ VideoGameFilters component
4. ⬜ SearchBar component (if needed)
5. ⬜ Main gallery page: `app/video-games/page.tsx`
6. ⬜ Detail page: `app/video-games/[id]/page.tsx`
7. ⬜ Test migration script
8. ⬜ Verify build succeeds
9. ⬜ Update version to 1.4.8
10. ⬜ Commit to staging branch

---

## 🎯 Implementation Tasks

### Task 1: Create VideoGameCard Component

**File:** `components/features/video-games/VideoGameCard.tsx`

**Requirements:**
- Display 16:9 landscape image
- Game name overlay with bottom gradient
- Genre badges (like board games)
- Click opens modal
- Responsive: fits grid layout (4/3/2 columns)

**Reference Pattern:** Study `components/features/games/GameCard.tsx` for board games

**Code Structure:**
```tsx
'use client';

import { VideoGame } from '@/types';
import Image from 'next/image';
import { useState } from 'react';

interface VideoGameCardProps {
  game: VideoGame;
  onClick: () => void;
}

export default function VideoGameCard({ game, onClick }: VideoGameCardProps) {
  const imageUrl = game.image_landscape_url || '/placeholder-game.jpg';

  // Format release date from YYYYMMDD to readable format
  const formatDate = (date: number | undefined) => {
    if (!date) return 'Unknown';
    const dateStr = date.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${month}/${day}/${year}`;
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 bg-gray-900"
    >
      {/* 16:9 Aspect Ratio Container */}
      <div className="relative w-full pb-[56.25%]"> {/* 56.25% = 9/16 for 16:9 ratio */}
        <Image
          src={imageUrl}
          alt={game.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />

        {/* Bottom Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Game Name */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-lg line-clamp-2">
            {game.name}
          </h3>
          <p className="text-gray-300 text-sm mt-1">
            {game.publisher || 'Unknown Publisher'}
          </p>
        </div>
      </div>

      {/* Genre Badges */}
      {game.category && game.category.length > 0 && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {game.category.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full"
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      {/* Rating Badge (if has rating content) */}
      {game.rating_content && game.rating_content.length > 0 && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded-full">
            {game.rating_content[0]}
          </span>
        </div>
      )}
    </div>
  );
}
```

**Verification:**
- Component compiles without errors
- Image displays correctly
- Hover effects work
- Click handler fires

---

### Task 2: Create VideoGameModal Component

**File:** `components/features/video-games/VideoGameModal.tsx`

**Requirements:**
- Large landscape image at top
- Game metadata: name, publisher, release date, genres, players, rating
- Description text
- Location badges (which switches have it)
- "View Full Details" button → navigates to `/video-games/[id]`
- Close button (X)
- Click outside to close

**Reference Pattern:** Study `components/features/games/GameDetailModal.tsx` for board games

**Code Structure:**
```tsx
'use client';

import { VideoGame } from '@/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react'; // or any icon library you use

interface VideoGameModalProps {
  game: VideoGame;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoGameModal({ game, isOpen, onClose }: VideoGameModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const formatDate = (date: number | undefined) => {
    if (!date) return 'Unknown';
    const dateStr = date.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
        >
          <X size={24} />
        </button>

        {/* Large Landscape Image */}
        <div className="relative w-full h-64 md:h-96">
          <Image
            src={game.image_landscape_url || '/placeholder-game.jpg'}
            alt={game.name}
            fill
            className="object-cover"
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title and Publisher */}
          <h2 className="text-3xl font-bold mb-2">{game.name}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {game.publisher || 'Unknown Publisher'}
          </p>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Release Date</p>
              <p className="font-semibold">{formatDate(game.release_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Players</p>
              <p className="font-semibold">
                {game.number_of_players ? `Up to ${game.number_of_players}` : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Platform</p>
              <p className="font-semibold capitalize">{game.platform}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Languages</p>
              <p className="font-semibold">{game.languages?.length || 0} languages</p>
            </div>
          </div>

          {/* Genres */}
          {game.category && game.category.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Genres</p>
              <div className="flex flex-wrap gap-2">
                {game.category.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rating Content */}
          {game.rating_content && game.rating_content.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Rating Content</p>
              <div className="flex flex-wrap gap-2">
                {game.rating_content.map((rating) => (
                  <span
                    key={rating}
                    className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm"
                  >
                    {rating}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Location Badges */}
          {game.located_on && game.located_on.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Available On</p>
              <div className="flex flex-wrap gap-2">
                {game.located_on.map((console) => (
                  <span
                    key={console}
                    className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-semibold"
                  >
                    {console}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {game.description && (
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {game.description}
              </p>
            </div>
          )}

          {/* View Full Details Button */}
          <button
            onClick={() => router.push(`/video-games/${game.id}`)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            View Full Details
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Verification:**
- Modal opens/closes correctly
- All game metadata displays
- "View Full Details" navigates correctly
- Click outside closes modal
- Responsive on mobile

---

### Task 3: Create VideoGameFilters Component

**File:** `components/features/video-games/VideoGameFilters.tsx`

**Requirements:**
- Collapsible section (starts collapsed)
- Multi-select checkboxes for console locations (Samus, Toad, Yoshi, Fox, LMac, Wolf)
- Genre dropdown (populated from available genres)
- "Clear filters" button
- Emit filter changes to parent component

**Reference Pattern:** Study `components/features/games/AdvancedFilters.tsx` for board games

**Code Structure:**
```tsx
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

          {/* Genre Filter */}
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
```

**Verification:**
- Expands/collapses correctly
- Checkboxes toggle correctly
- Filter changes emit to parent
- Clear filters resets everything

---

### Task 4: Create Main Gallery Page

**File:** `app/video-games/page.tsx`

**Requirements:**
- Fetch games from `/api/video-games`
- Display in responsive grid (4 cols desktop, 3 tablet, 2 mobile)
- Search bar at top
- Filters component (collapsed by default)
- Click card opens modal
- Modal can navigate to detail page

**Reference Pattern:** Study `app/games/page.tsx` for board games

**Code Structure:**
```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { VideoGame } from '@/types';
import VideoGameCard from '@/components/features/video-games/VideoGameCard';
import VideoGameModal from '@/components/features/video-games/VideoGameModal';
import VideoGameFilters from '@/components/features/video-games/VideoGameFilters';

export default function VideoGamesPage() {
  const [games, setGames] = useState<VideoGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<VideoGame | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    locatedOn: string[];
    category: string[];
  }>({
    locatedOn: [],
    category: [],
  });

  // Fetch games
  useEffect(() => {
    async function fetchGames() {
      try {
        setLoading(true);
        const response = await fetch('/api/video-games');
        if (!response.ok) throw new Error('Failed to fetch games');
        const data = await response.json();
        setGames(data.games || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, []);

  // Get unique locations and categories
  const availableLocations = useMemo(() => {
    const locations = new Set<string>();
    games.forEach(game => {
      game.located_on?.forEach(loc => locations.add(loc));
    });
    return Array.from(locations).sort();
  }, [games]);

  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    games.forEach(game => {
      game.category?.forEach(cat => categories.add(cat));
    });
    return Array.from(categories).sort();
  }, [games]);

  // Filter and search games
  const filteredGames = useMemo(() => {
    return games.filter(game => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = game.name.toLowerCase().includes(query);
        const publisherMatch = game.publisher?.toLowerCase().includes(query);
        if (!nameMatch && !publisherMatch) return false;
      }

      // Location filter (OR logic - game on ANY selected console)
      if (filters.locatedOn.length > 0) {
        const hasLocation = game.located_on?.some(loc =>
          filters.locatedOn.includes(loc)
        );
        if (!hasLocation) return false;
      }

      // Category filter (OR logic - game has ANY selected genre)
      if (filters.category.length > 0) {
        const hasCategory = game.category?.some(cat =>
          filters.category.includes(cat)
        );
        if (!hasCategory) return false;
      }

      return true;
    });
  }, [games, searchQuery, filters]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-xl">Loading video games...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          <p className="text-xl">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <h1 className="text-4xl font-bold mb-8">Video Games Library</h1>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or publisher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Filters */}
      <VideoGameFilters
        onFilterChange={setFilters}
        availableLocations={availableLocations}
        availableCategories={availableCategories}
      />

      {/* Game Count */}
      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-400">
          Showing {filteredGames.length} of {games.length} games
        </p>
      </div>

      {/* Games Grid */}
      {filteredGames.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-500">No games found</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setFilters({ locatedOn: [], category: [] });
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredGames.map((game) => (
            <VideoGameCard
              key={game.id}
              game={game}
              onClick={() => setSelectedGame(game)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedGame && (
        <VideoGameModal
          game={selectedGame}
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}
```

**Verification:**
- Page loads and displays games
- Search works
- Filters work
- Grid is responsive (4/3/2 columns)
- Modal opens on card click

---

### Task 5: Create Detail Page

**File:** `app/video-games/[id]/page.tsx`

**Requirements:**
- Fetch single game from `/api/video-games/[id]`
- Display both landscape and portrait images (if available)
- Show all metadata fields
- Languages list
- Rating details expanded
- Back button to gallery

**Code Structure:**
```tsx
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

async function getGame(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/video-games/${id}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.game;
}

export default async function VideoGameDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const game = await getGame(params.id);

  if (!game) {
    notFound();
  }

  const formatDate = (date: number | undefined) => {
    if (!date) return 'Unknown';
    const dateStr = date.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Link
        href="/video-games"
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={20} />
        Back to Gallery
      </Link>

      {/* Images Section */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Landscape Image */}
        <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
          <Image
            src={game.image_landscape_url || '/placeholder-game.jpg'}
            alt={`${game.name} - Landscape`}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Portrait Image */}
        {game.image_portrait_url && (
          <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden">
            <Image
              src={game.image_portrait_url}
              alt={`${game.name} - Box Art`}
              fill
              className="object-contain bg-gray-100 dark:bg-gray-800"
            />
          </div>
        )}
      </div>

      {/* Game Info */}
      <div className="space-y-6">
        {/* Title and Publisher */}
        <div>
          <h1 className="text-4xl font-bold mb-2">{game.name}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            {game.publisher || 'Unknown Publisher'}
          </p>
          {game.developer && game.developer !== game.publisher && (
            <p className="text-gray-500 dark:text-gray-500">
              Developed by {game.developer}
            </p>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Release Date</p>
            <p className="font-semibold">{formatDate(game.release_date)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Players</p>
            <p className="font-semibold">
              {game.number_of_players ? `Up to ${game.number_of_players}` : 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Platform</p>
            <p className="font-semibold capitalize">{game.platform}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">TitleID</p>
            <p className="font-mono text-sm">{game.id}</p>
          </div>
        </div>

        {/* Genres */}
        {game.category && game.category.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Genres</h2>
            <div className="flex flex-wrap gap-2">
              {game.category.map((genre) => (
                <span
                  key={genre}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full font-medium"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rating Content */}
        {game.rating_content && game.rating_content.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Rating Content</h2>
            <div className="flex flex-wrap gap-2">
              {game.rating_content.map((rating) => (
                <span
                  key={rating}
                  className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full font-medium"
                >
                  {rating}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Console Locations */}
        {game.located_on && game.located_on.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Available On</h2>
            <div className="flex flex-wrap gap-2">
              {game.located_on.map((console) => (
                <span
                  key={console}
                  className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-bold"
                >
                  {console}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {game.languages && game.languages.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">
              Supported Languages ({game.languages.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {game.languages.map((lang) => (
                <span
                  key={lang}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-sm"
                >
                  {lang.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {game.description && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Description</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {game.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Verification:**
- Page loads with correct game data
- Both images display (if available)
- All metadata fields show correctly
- Back button navigates to gallery

---

### Task 6: Test Backend - Run Migration Script

**CRITICAL: Do this BEFORE building frontend to ensure data exists**

**Commands:**

```bash
# 1. Create database table on staging
node scripts/create-video-games-table.js

# Expected output: Table created with indexes

# 2. Run migration in dry-run mode (preview)
node scripts/migrate-switch-games.js --dry-run --limit=20

# Expected output: Shows what would be migrated

# 3. Run actual migration
node scripts/migrate-switch-games.js --limit=20

# Expected output: 20 games inserted, images downloaded
```

**Troubleshooting:**
- If CSV files not found: Check path `switchgamelist/` exists
- If database connection fails: Check `DATABASE_URL` environment variable
- If image downloads fail: Continue anyway, placeholders will be used
- If NX-DB fetch fails for a game: Skip that game, script continues

**Verification:**
- Check database has 20 games: `SELECT COUNT(*) FROM video_games;`
- Check images cached: Look in `/data/video-game-images/switch/`
- API endpoint works: `curl http://localhost:3000/api/video-games`

---

### Task 7: Build and Verify

**Commands:**

```bash
# Build project
npm run build

# Expected: Build succeeds with no errors
```

**If Build Fails:**

1. **TypeScript errors:**
   - Check all imports are correct
   - Check types match (VideoGame, VideoGameFilters)
   - Fix any type mismatches

2. **Module not found:**
   - Check file paths are correct
   - Check component exports are correct

3. **CSS/Tailwind errors:**
   - Ensure Tailwind classes are valid
   - Check dark mode variants work

4. **Image component errors:**
   - Ensure Next.js Image component used correctly
   - Check image URLs are strings

**DO NOT PROCEED** until build succeeds.

---

### Task 8: Update Version and Commit

**Steps:**

1. **Update version in `lib/version.ts`:**
```typescript
export const VERSION = '1.4.8';
```

2. **Update version in `package.json`:**
```json
{
  "version": "1.4.8",
  ...
}
```

3. **Git commit:**
```bash
git add .
git commit -m "v1.4.8 - Nintendo Switch Video Games Gallery

Implemented video games gallery with 20 Nintendo Switch games:
- VideoGameCard component with 16:9 landscape layout
- VideoGameModal with full metadata and location badges
- VideoGameFilters with console location and genre filtering
- Responsive gallery page (/video-games) with search
- Detail page (/video-games/[id]) with complete information
- Backend API endpoints and database service
- Migration script for NX-DB data scraping
- Image caching from Nintendo CDN

Future-proof architecture supports PS5, Xbox, and other platforms.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin staging
```

---

## 📁 File Reference Guide

### Existing Files to Study

**Board Games Gallery (Reference):**
- `app/games/page.tsx` - Main gallery structure
- `components/features/games/GameCard.tsx` - Card component pattern
- `components/features/games/GameDetailModal.tsx` - Modal pattern
- `components/features/games/AdvancedFilters.tsx` - Filter pattern
- `lib/services/games-db-service.ts` - Database service pattern

**Styling:**
- Project uses Tailwind CSS
- Dark mode classes: `dark:bg-gray-900`, `dark:text-gray-300`
- Responsive: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

### New Files to Create

1. `components/features/video-games/VideoGameCard.tsx`
2. `components/features/video-games/VideoGameModal.tsx`
3. `components/features/video-games/VideoGameFilters.tsx`
4. `app/video-games/page.tsx`
5. `app/video-games/[id]/page.tsx`

---

## 🧪 Testing Checklist

After completing all tasks, verify:

- [ ] Migration script runs successfully (20 games inserted)
- [ ] API endpoint returns games: `curl http://localhost:3000/api/video-games`
- [ ] Gallery page loads: `http://localhost:3000/video-games`
- [ ] 20 game cards display in responsive grid
- [ ] Click card opens modal
- [ ] Modal displays all game information
- [ ] "View Full Details" navigates to detail page
- [ ] Detail page shows complete game information
- [ ] Search filters games by name/publisher
- [ ] Console location filter works (multi-select)
- [ ] Genre filter works (multi-select)
- [ ] Clear filters resets everything
- [ ] Responsive layout works on mobile (2 columns)
- [ ] Responsive layout works on tablet (3 columns)
- [ ] Responsive layout works on desktop (4 columns)
- [ ] Images load from cache (`/api/video-games/images/[titleId]`)
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No console errors in browser
- [ ] Version updated to 1.4.8
- [ ] Changes committed to staging branch

---

## 🚨 Common Issues and Solutions

### Issue: "Module not found" errors
**Solution:** Check import paths are correct, ensure all files created in correct directories

### Issue: TypeScript errors about VideoGame type
**Solution:** Ensure `types/index.ts` is imported correctly: `import { VideoGame } from '@/types';`

### Issue: Images not loading
**Solution:** Check migration script ran successfully, check images exist in `/data/video-game-images/switch/`

### Issue: Filters not working
**Solution:** Check filter state is passed correctly from parent to child components

### Issue: Modal not closing
**Solution:** Check onClick handlers are set up correctly, ensure backdrop click calls onClose

### Issue: Grid layout broken
**Solution:** Check Tailwind classes: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`

### Issue: Build fails with CSS errors
**Solution:** Ensure Tailwind CSS is configured, check `tailwind.config.js` includes new components

### Issue: Dark mode not working
**Solution:** Ensure dark mode classes are used: `dark:bg-gray-900 dark:text-gray-300`

---

## 📞 Emergency Contact

If you encounter a **MAJOR BLOCKER** that cannot be resolved:

1. Document the exact error message
2. Document what you tried to fix it
3. Document which task you completed up to that point
4. Save all progress
5. Report the blocker with:
   - Error message
   - Stack trace
   - Steps to reproduce
   - What you tried

**DO NOT STOP** for minor issues like styling tweaks or small type errors - FIX THEM AND CONTINUE.

---

## ✅ Completion Checklist

Mark each as complete:

- [ ] Task 1: VideoGameCard component created and working
- [ ] Task 2: VideoGameModal component created and working
- [ ] Task 3: VideoGameFilters component created and working
- [ ] Task 4: Main gallery page created and working
- [ ] Task 5: Detail page created and working
- [ ] Task 6: Migration script tested (20 games in database)
- [ ] Task 7: Build succeeds with no errors
- [ ] Task 8: Version updated and committed to staging
- [ ] All tests in testing checklist pass
- [ ] Gallery displays games correctly
- [ ] No console errors
- [ ] Responsive on all screen sizes

---

**REMEMBER: DO NOT STOP UNTIL ALL CHECKBOXES ARE CHECKED.**

**Success = All components working + Build passing + Committed to staging**

Good luck! 🚀
