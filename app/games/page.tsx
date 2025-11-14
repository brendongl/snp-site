'use client';

import { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SearchBar } from '@/components/features/games/SearchBar';
import { GameFilters } from '@/components/features/games/GameFilters';
import { AdvancedFilters } from '@/components/features/games/AdvancedFilters';
import { GameCard } from '@/components/features/games/GameCard';
import { GameDetailModal } from '@/components/features/games/GameDetailModal';
import { SpinnerWheel } from '@/components/features/games/SpinnerWheel';
import { AddGameDialog } from '@/components/features/games/AddGameDialog';
import { StaffLoginDialog } from '@/components/features/staff/StaffLoginDialog';
import { AddGameKnowledgeDialog } from '@/components/features/staff/AddGameKnowledgeDialog'; // v1.2.0
import { BoardGame, GameFilters as FilterType, SortOption } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shuffle, Loader2, RefreshCw, Plus, ChevronDown, ChevronUp, Images, Home } from 'lucide-react';
import { VERSION, BUILD_DATE } from '@/lib/version';
import { useStaffMode } from '@/lib/hooks/useStaffMode';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button';
import { StaffMenu } from '@/components/features/staff/StaffMenu';
import { trackGameViewed, trackAdvancedFiltersSelected, trackSpecialFilterCount } from '@/lib/analytics/mixpanel';

function GamesPageContent() {
  const isStaff = useStaffMode();
  const isAdmin = useAdminMode();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<BoardGame[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('dateAcquired');
  const [showSpinner, setShowSpinner] = useState(false);
  const [spinnerGames, setSpinnerGames] = useState<BoardGame[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAddGameDialog, setShowAddGameDialog] = useState(false);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  const [staffSortOption, setStaffSortOption] = useState<SortOption | null>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [picturesOnlyMode, setPicturesOnlyMode] = useState(false);
  const [staffKnowledge, setStaffKnowledge] = useState<Map<string, {id: string, confidenceLevel: string, notes?: string}>>(new Map());
  // v1.2.0: Knowledge dialog state
  const [showKnowledgeDialog, setShowKnowledgeDialog] = useState(false);
  const [knowledgeDialogGame, setKnowledgeDialogGame] = useState<BoardGame | null>(null);

  // v1.5.0: Staff ID for issue reporting
  const [staffId, setStaffId] = useState<string | null>(null);

  // Track which game ID was auto-opened from query param to prevent re-opening
  const autoOpenedGameId = useRef<string | null>(null);

  // Staff knowledge filters (staff mode only)
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string }>>([]);
  const [allStaffKnowledge, setAllStaffKnowledge] = useState<Array<{ staffMemberId: string; gameName: string; confidenceLevel: string }>>([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [selectedKnowledgeFilter, setSelectedKnowledgeFilter] = useState<string>('all');

  const [filters, setFilters] = useState<FilterType>({
    search: '',
    quickFilter: undefined,
  });

  // Clean up old localStorage data from pre-UUID migration
  useEffect(() => {
    // Remove old staff_record_id if it exists
    if (localStorage.getItem('staff_record_id')) {
      console.log('🧹 Cleaning up old staff_record_id from localStorage');
      localStorage.removeItem('staff_record_id');
    }

    // Validate staff_id is a valid UUID if it exists
    const staffIdFromStorage = localStorage.getItem('staff_id');
    if (staffIdFromStorage && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffIdFromStorage)) {
      console.warn('⚠️ Invalid staff_id format detected. Clearing staff session.');
      localStorage.removeItem('staff_id');
      localStorage.removeItem('staff_name');
      localStorage.removeItem('staff_email');
      localStorage.removeItem('staff_type');
    } else if (staffIdFromStorage) {
      setStaffId(staffIdFromStorage);
    }
  }, []);

  // Load collapse preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('headerCollapsed');
    if (saved !== null) {
      setIsHeaderCollapsed(saved === 'true');
    }
  }, []);

  // Handle login success - refresh page to show staff mode
  const handleLoginSuccess = () => {
    // Trigger page refresh to pick up the new localStorage values
    window.location.reload();
  };

  // Fetch games from API (cached server-side)
  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/games');

      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }

      const data = await response.json();
      setGames(data.games);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff knowledge (extracted for manual refresh)
  const fetchStaffKnowledge = async () => {
    if (!isStaff) return;

    try {
      const staffName = localStorage.getItem('staff_name');
      if (!staffName) return;

      const response = await fetch('/api/staff-knowledge');
      if (!response.ok) return;

      const data = await response.json();
      const knowledge = data.knowledge || [];

      // Create a map of gameId -> {id, confidenceLevel, notes} for current staff member
      const knowledgeMap = new Map<string, {id: string, confidenceLevel: string, notes?: string}>();
      knowledge
        .filter((k: any) => k.staffMember === staffName)
        .forEach((k: any) => {
          const matchingGame = games.find(g => g.fields['Game Name'] === k.gameName);
          if (matchingGame) {
            knowledgeMap.set(matchingGame.id, {
              id: k.id,
              confidenceLevel: k.confidenceLevel,
              notes: k.notes || '',
            });
          }
        });

      setStaffKnowledge(knowledgeMap);
    } catch (err) {
      console.error('Error fetching staff knowledge:', err);
    }
  };

  // Combined refresh function (for modal callbacks)
  const handleRefresh = async () => {
    await fetchGames();
    await fetchStaffKnowledge();

    // If a game is currently selected, refresh its data to show updated images
    if (selectedGame) {
      try {
        const response = await fetch(`/api/games/${selectedGame.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.game) {
            setSelectedGame(data.game);
          }
        }
      } catch (error) {
        console.error('Failed to refresh selected game:', error);
      }
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  // Fetch staff knowledge for current user (staff mode only)
  useEffect(() => {
    if (!isStaff) {
      setStaffKnowledge(new Map());
      return;
    }

    if (games.length > 0) {
      fetchStaffKnowledge();
    }
  }, [isStaff, games]);

  // Fetch staff list for knowledge filter (staff mode only)
  useEffect(() => {
    if (!isStaff) return;

    const fetchStaffList = async () => {
      try {
        const response = await fetch('/api/staff-list');
        if (!response.ok) return;
        const data = await response.json();
        const staff = data.staff || [];
        console.log('📋 STAFF LIST DEBUG:');
        console.log('  Fetched', staff.length, 'staff members');
        if (staff.length > 0) {
          console.log('  Sample staff entry:', staff[0]);
        }
        // API returns { id, name, type } where id is UUID primary key
        const mappedStaff = staff.map((s: any) => ({ id: s.id, name: s.name }));
        console.log('  Mapped staff list:', mappedStaff);
        setStaffList(mappedStaff);
      } catch (err) {
        console.error('Error fetching staff list:', err);
      }
    };

    fetchStaffList();
  }, [isStaff]);

  // Fetch all staff knowledge for filtering (staff mode only)
  useEffect(() => {
    if (!isStaff || games.length === 0) return;

    const fetchAllKnowledge = async () => {
      try {
        const response = await fetch('/api/staff-knowledge');
        if (!response.ok) return;
        const data = await response.json();
        const knowledge = data.knowledge || [];
        console.log('📚 STAFF KNOWLEDGE DEBUG:');
        console.log('  Fetched', knowledge.length, 'knowledge records');
        if (knowledge.length > 0) {
          console.log('  Sample knowledge entry:', knowledge[0]);
        }
        setAllStaffKnowledge(knowledge);
      } catch (err) {
        console.error('Error fetching all staff knowledge:', err);
      }
    };

    fetchAllKnowledge();
  }, [isStaff, games]);

  // Handle knowledgeFilter query parameter from dashboard
  useEffect(() => {
    const knowledgeFilter = searchParams?.get('knowledgeFilter');
    if (knowledgeFilter === 'unknown') {
      const staffId = localStorage.getItem('staff_id');
      if (staffId) {
        setSelectedStaffFilter(staffId);
        setSelectedKnowledgeFilter('none');
      }
    }
  }, [searchParams]);

  // Auto-open game modal from query parameter
  useEffect(() => {
    const openGameId = searchParams?.get('openGame');
    // Only auto-open if we haven't already opened this game ID
    if (openGameId && games.length > 0 && autoOpenedGameId.current !== openGameId) {
      const gameToOpen = games.find(g => g.id === openGameId);
      if (gameToOpen) {
        setSelectedGame(gameToOpen);
        autoOpenedGameId.current = openGameId;
      }
    }
  }, [searchParams, games]);

  // Close modal and clear openGame query param
  const handleCloseModal = () => {
    setSelectedGame(null);
    // Reset the auto-open tracking so the same game can be opened again later
    autoOpenedGameId.current = null;
    // Clear openGame param if it exists
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('openGame')) {
      currentParams.delete('openGame');
      const newSearch = currentParams.toString();
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}`;
      router.replace(newUrl);
    }
  };

  // Toggle header collapse and save preference
  const toggleHeaderCollapse = () => {
    const newValue = !isHeaderCollapsed;
    setIsHeaderCollapsed(newValue);
    localStorage.setItem('headerCollapsed', String(newValue));
  };

  // Client-side filtering and sorting
  const filteredAndSortedGames = useMemo(() => {
    // Filter out expansions - they will only show within their base game
    let filtered = games.filter(game => !game.fields.Expansion);

    // Search filter - only search game name, not description
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(game =>
        game.fields['Game Name']?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter with AND/OR mode
    if (filters.categories && filters.categories.length > 0) {
      const matchMode = filters.categoryMatchMode || 'OR';
      filtered = filtered.filter(game => {
        const gameCategories = game.fields['Categories'] || [];
        if (matchMode === 'AND') {
          // ALL selected categories must be present
          return filters.categories!.every(cat => gameCategories.includes(cat));
        } else {
          // ANY selected category must be present (OR mode)
          return filters.categories!.some(cat => gameCategories.includes(cat));
        }
      });
    }

    // Player count filter
    // Min/Max Players are string fields in Airtable, so we need to convert them
    if (filters.playerCount?.min || filters.playerCount?.max) {
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const maxPlayersStr = game.fields['Max. Players'];

        // Skip games without player count data
        if (!minPlayersStr || !maxPlayersStr) return false;

        // Handle "No Limit" as a very high number
        const minPlayers = parseInt(minPlayersStr);
        const maxPlayers = maxPlayersStr === 'No Limit' ? 999 : parseInt(maxPlayersStr);

        const hasMin = filters.playerCount?.min !== undefined;
        const hasMax = filters.playerCount?.max !== undefined;

        // v1.9.6: If only ONE is set (min OR max), treat as exact player count
        if (hasMin && !hasMax) {
          const exactCount = filters.playerCount!.min!;
          return minPlayers <= exactCount && maxPlayers >= exactCount;
        }
        if (hasMax && !hasMin) {
          const exactCount = filters.playerCount!.max!;
          return minPlayers <= exactCount && maxPlayers >= exactCount;
        }

        // v1.9.6: If BOTH are set, use strict containment
        // Only show games where the entire game range fits within the selected range
        const selectedMin = filters.playerCount?.min!;
        const selectedMax = filters.playerCount?.max!;

        return minPlayers >= selectedMin && maxPlayers <= selectedMax;
      });
    }

    // v1.9.6: Exact Player Count filter (takes priority over range filter)
    if (filters.exactPlayerCount) {
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const maxPlayersStr = game.fields['Max. Players'];

        if (!minPlayersStr || !maxPlayersStr) return false;

        const minPlayers = parseInt(minPlayersStr);
        const maxPlayers = maxPlayersStr === 'No Limit' ? 999 : parseInt(maxPlayersStr);

        // Show games where exactPlayerCount is within the game's range
        return minPlayers <= filters.exactPlayerCount! && maxPlayers >= filters.exactPlayerCount!;
      });
    }

    // Year range filter
    if (filters.yearRange?.min) {
      filtered = filtered.filter(game =>
        (game.fields['Year Released'] || 0) >= filters.yearRange!.min!
      );
    }
    if (filters.yearRange?.max) {
      filtered = filtered.filter(game =>
        (game.fields['Year Released'] || 0) <= filters.yearRange!.max!
      );
    }

    // Complexity filter
    if (filters.complexity?.min) {
      filtered = filtered.filter(game =>
        (game.fields['Complexity'] || 0) >= filters.complexity!.min!
      );
    }
    if (filters.complexity?.max) {
      filtered = filtered.filter(game =>
        (game.fields['Complexity'] || 0) <= filters.complexity!.max!
      );
    }

    // Playtime filter - show games that can be played within the selected time
    if (filters.playtime) {
      filtered = filtered.filter(game => {
        const minPlaytime = game.fields['Min Playtime'];
        const maxPlaytime = game.fields['Max Playtime'];

        // Skip games without playtime data
        if (!minPlaytime && !maxPlaytime) return false;

        // Show games where the selected time falls within the game's playtime range
        // e.g., if user selects 60 minutes, show games with min<=60 AND max>=60
        const selectedTime = filters.playtime!;
        return (minPlaytime || 0) <= selectedTime && (maxPlaytime || 999) >= selectedTime;
      });
    }

    // Best Player Count filter
    if (filters.bestPlayerCount) {
      filtered = filtered.filter(game => {
        const bestPlayerAmount = game.fields['Best Player Amount'];
        if (!bestPlayerAmount) return false;
        // Convert both to strings for comparison, handling potential whitespace
        const bestAmountStr = bestPlayerAmount.toString().trim();
        const filterStr = filters.bestPlayerCount!.toString();
        return bestAmountStr === filterStr;
      });
    }

    // Quick filters
    if (filters.quickFilter === 'sixPlus') {
      filtered = filtered.filter(game => {
        const maxPlayersStr = game.fields['Max. Players'];
        if (!maxPlayersStr) return false;

        const maxPlayers = maxPlayersStr === 'No Limit' ? 999 : parseInt(maxPlayersStr);

        // Min can be any amount, max must be at least 6
        return maxPlayers >= 6;
      });
    } else if (filters.quickFilter === 'couples') {
      // Show games that are exactly 2 players (min=2, max=2) OR where best player count is 2
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const maxPlayersStr = game.fields['Max. Players'];
        const bestPlayerAmount = game.fields['Best Player Amount'];

        // Normalize values by trimming whitespace and converting to string
        const minPlayers = minPlayersStr?.toString().trim();
        const maxPlayers = maxPlayersStr?.toString().trim();
        const bestPlayers = bestPlayerAmount?.toString().trim();

        // Check if it's exactly a 2-player game
        const isExactlyTwoPlayers = minPlayers === '2' && maxPlayers === '2';

        // Check if best player count is 2
        const isBestForTwo = bestPlayers === '2';

        // Log for debugging (only first 3 matches)
        if (isExactlyTwoPlayers || isBestForTwo) {
          console.log('[Couples Filter Match]', game.fields['Game Name'], {
            minPlayers,
            maxPlayers,
            bestPlayers,
            isExactlyTwoPlayers,
            isBestForTwo
          });
        }

        return isExactlyTwoPlayers || isBestForTwo;
      });
    } else if (filters.quickFilter === 'social') {
      filtered = filtered.filter(game => {
        const minPlayersStr = game.fields['Min Players'];
        const maxPlayersStr = game.fields['Max. Players'];
        const categories = game.fields['Categories'] || [];

        if (!minPlayersStr || !maxPlayersStr) return false;

        const minPlayers = parseInt(minPlayersStr);
        const maxPlayers = maxPlayersStr === 'No Limit' ? 999 : parseInt(maxPlayersStr);

        // Min must be at least 2, max must be at least 4, and must have ANY of: Party, Deduction, or Social categories
        const hasSocialCategory = categories.some(cat =>
          cat === 'Party' || cat === 'Deduction' || cat === 'Social'
        );

        return minPlayers >= 2 && maxPlayers >= 4 && hasSocialCategory;
      });
    } else if (filters.quickFilter === 'noChecks') {
      filtered = filtered.filter(game => {
        const totalChecks = game.fields['Total Checks'];
        // Show games with no checks (undefined, 0, or null)
        return !totalChecks || totalChecks === 0;
      });
    } else if (filters.quickFilter === 'hasIssues') {
      // v1.2.0: Filter to show only games where latest check has hasIssue=true
      filtered = filtered.filter(game => {
        return (game as any).latestCheck?.hasIssue === true;
      });
    }

    // Staff Knowledge Filter (staff mode only)
    // Run filtering when EITHER staff member OR knowledge level is selected
    if (isStaff && (selectedStaffFilter !== 'all' || selectedKnowledgeFilter !== 'all')) {
      console.log('🔍 STAFF FILTER DEBUG:');
      console.log('  selectedStaffFilter:', selectedStaffFilter);
      console.log('  selectedKnowledgeFilter:', selectedKnowledgeFilter);
      console.log('  allStaffKnowledge count:', allStaffKnowledge.length);
      if (allStaffKnowledge.length > 0) {
        console.log('  Sample knowledge entry:', allStaffKnowledge[0]);
      }

      filtered = filtered.filter(game => {
        const gameName = game.fields['Game Name'];
        if (!gameName) return false;

        // Get knowledge records for this game
        const gameKnowledge = allStaffKnowledge.filter(k => k.gameName === gameName);

        // If specific staff member selected, filter by that staff member
        let relevantKnowledge = gameKnowledge;
        if (selectedStaffFilter !== 'all') {
          console.log(`  Filtering ${gameName}: gameKnowledge=${gameKnowledge.length}, checking staffMemberId against ${selectedStaffFilter}`);
          if (gameKnowledge.length > 0) {
            console.log(`    First knowledge entry staffMemberId: ${gameKnowledge[0].staffMemberId}`);
          }
          relevantKnowledge = gameKnowledge.filter(k => k.staffMemberId === selectedStaffFilter);
          console.log(`    After staff filter: ${relevantKnowledge.length} relevant entries`);
        }

        // Apply knowledge level filter
        if (selectedKnowledgeFilter === 'none') {
          // Show games with NO knowledge records for this staff member
          return relevantKnowledge.length === 0;
        } else if (selectedKnowledgeFilter === 'beginner-intermediate') {
          // Show games with Beginner or Intermediate knowledge
          return relevantKnowledge.some(k => k.confidenceLevel === 'Beginner' || k.confidenceLevel === 'Intermediate');
        } else if (selectedKnowledgeFilter === 'expert-instructor') {
          // Show games with Expert or Instructor knowledge
          return relevantKnowledge.some(k => k.confidenceLevel === 'Expert' || k.confidenceLevel === 'Instructor');
        } else {
          // knowledge level is 'all' - show games with ANY knowledge for the selected staff
          return relevantKnowledge.length > 0;
        }
      });
    }

    // Sorting - use staff sort if set, otherwise regular sort
    const activeSortOption = staffSortOption || sortOption;

    filtered.sort((a, b) => {
      // v1.2.0: Auto-float games with issues to top when using default sort (staff mode only)
      if (isStaff && activeSortOption === 'dateAcquired') {
        const aHasIssue = (a as any).latestCheck?.hasIssue === true;
        const bHasIssue = (b as any).latestCheck?.hasIssue === true;

        // If one has issue and the other doesn't, prioritize the one with issue
        if (aHasIssue && !bHasIssue) return -1; // a comes first
        if (!aHasIssue && bHasIssue) return 1;  // b comes first
        // If both have issues or both don't, continue to regular sort
      }

      const nameA = a.fields['Game Name'] || '';
      const nameB = b.fields['Game Name'] || '';

      switch (activeSortOption) {
        case 'needsChecking': {
          // v1.3.0: Sort by needs checking criteria
          const aInfo = (a as any).needsCheckingInfo;
          const bInfo = (b as any).needsCheckingInfo;

          // Games that need checking come first
          if (aInfo?.needsChecking && !bInfo?.needsChecking) return -1;
          if (!aInfo?.needsChecking && bInfo?.needsChecking) return 1;

          // If both need checking (or both don't), sort by criterion priority
          if (aInfo?.needsChecking && bInfo?.needsChecking) {
            // Lower criterion number = higher priority (1 is most urgent)
            if (aInfo.criterion !== bInfo.criterion) {
              return (aInfo.criterion || 999) - (bInfo.criterion || 999);
            }
            // Within same criterion, sort by sortPriority (higher = more urgent)
            return (bInfo.sortPriority || 0) - (aInfo.sortPriority || 0);
          }

          // If neither needs checking, sort alphabetically
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'alphabetical':
          // Use localeCompare with numeric option to handle numbers properly
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
        case 'alphabeticalDesc':
          return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
        case 'year':
          return (b.fields['Year Released'] || 0) - (a.fields['Year Released'] || 0);
        case 'maxPlayers': {
          const maxA = a.fields['Max. Players'] === 'No Limit' ? 999 : parseInt(a.fields['Max. Players'] || '0');
          const maxB = b.fields['Max. Players'] === 'No Limit' ? 999 : parseInt(b.fields['Max. Players'] || '0');
          return maxB - maxA;
        }
        case 'complexity':
          return (a.fields['Complexity'] || 0) - (b.fields['Complexity'] || 0);
        case 'lastChecked':
          return (b.fields['Latest Check Date'] || '').localeCompare(a.fields['Latest Check Date'] || '');
        case 'lastCheckedDesc':
          return (a.fields['Latest Check Date'] || '').localeCompare(b.fields['Latest Check Date'] || '');
        case 'totalChecks':
          return (b.fields['Total Checks'] || 0) - (a.fields['Total Checks'] || 0);
        case 'totalChecksDesc':
          return (a.fields['Total Checks'] || 0) - (b.fields['Total Checks'] || 0);
        case 'dateAcquired':
        default:
          return (b.fields['Date of Aquisition'] || '').localeCompare(a.fields['Date of Aquisition'] || '');
      }
    });

    return filtered;
  }, [games, filters, sortOption, staffSortOption, selectedStaffFilter, selectedKnowledgeFilter, allStaffKnowledge, isStaff]);

  // Calculate active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categories && filters.categories.length > 0) count++;
    if (filters.playerCount?.min || filters.playerCount?.max) count++;
    if (filters.yearRange?.min || filters.yearRange?.max) count++;
    if (filters.complexity?.min || filters.complexity?.max) count++;
    if (filters.playtime) count++;
    if (filters.bestPlayerCount) count++;
    if (filters.exactPlayerCount) count++; // v1.9.6
    return count;
  }, [filters]);

  // Handle search
  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  // Handle quick filter
  const handleQuickFilter = (filter: 'sixPlus' | 'couples' | 'social' | 'noChecks' | 'hasIssues' | null) => {
    setFilters(prev => ({ ...prev, quickFilter: filter || undefined }));
  };

  // Handle advanced filters with tracking
  const handleApplyAdvancedFilters = (newFilters: FilterType) => {
    setFilters(newFilters);

    // Track advanced filters applied
    trackAdvancedFiltersSelected({
      search: newFilters.search,
      categories: newFilters.categories || [],
      playerCount: newFilters.playerCount,
      yearRange: newFilters.yearRange,
      complexity: newFilters.complexity,
      playtime: newFilters.playtime,
      bestPlayerCount: newFilters.bestPlayerCount,
      categoryMatchMode: newFilters.categoryMatchMode,
    });

    // Track special filter count (number of active filters)
    const activeFilters: string[] = [];
    if (newFilters.search) activeFilters.push('search');
    if (newFilters.categories?.length) activeFilters.push('categories');
    if (newFilters.playerCount?.min || newFilters.playerCount?.max) activeFilters.push('playerCount');
    if (newFilters.yearRange?.min || newFilters.yearRange?.max) activeFilters.push('yearRange');
    if (newFilters.complexity?.min || newFilters.complexity?.max) activeFilters.push('complexity');
    if (newFilters.bestPlayerCount) activeFilters.push('bestPlayerCount');

    if (activeFilters.length > 0) {
      trackSpecialFilterCount(activeFilters.length, activeFilters);
    }
  };

  // Handle clear all filters
  const handleClearAll = () => {
    setFilters({
      search: '',
      quickFilter: undefined,
      categories: undefined,
      playerCount: undefined,
      yearRange: undefined,
      complexity: undefined,
      bestPlayerCount: undefined,
      exactPlayerCount: undefined, // v1.9.6
    });
  };

  // Check if any filters are active
  const hasAnyFilters = useMemo(() => {
    return !!(
      filters.search ||
      filters.quickFilter ||
      (filters.categories && filters.categories.length > 0) ||
      filters.playerCount?.min ||
      filters.playerCount?.max ||
      filters.yearRange?.min ||
      filters.yearRange?.max ||
      filters.complexity?.min ||
      filters.complexity?.max ||
      filters.bestPlayerCount ||
      filters.exactPlayerCount // v1.9.6
    );
  }, [filters]);

  // Handle random game with spinner wheel
  const handleRandomGame = () => {
    setSpinnerGames(filteredAndSortedGames);
    setShowSpinner(true);
  };

  const handleSpinnerComplete = (game: BoardGame) => {
    setShowSpinner(false);
    setSelectedGame(game);
    // Track game view
    trackGameViewed(game.id, game.fields['Game Name'] || 'Unknown');
  };

  const handleGameCardClick = (game: BoardGame) => {
    setSelectedGame(game);
    // Track game view
    trackGameViewed(game.id, game.fields['Game Name'] || 'Unknown');
  };

  // v1.2.0: Handle knowledge badge click
  const handleKnowledgeBadgeClick = (game: BoardGame) => {
    setKnowledgeDialogGame(game);
    setShowKnowledgeDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => fetchGames()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Unified Sticky Header - Sip & Play Brand Colors */}
      <div className="sticky top-0 z-40 bg-primary shadow-md">
        <div className="container mx-auto px-3 sm:px-4 py-3 max-w-full">
          {/* Top Row - Title, Version, Buttons */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            {/* Left side - Title and version (hidden when collapsed) */}
            {!isHeaderCollapsed && (
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white truncate">
                  🎲 Board Games
                </h1>
                <div
                  className="hidden sm:flex px-2 py-0.5 bg-white/20 border border-white/30 rounded-full text-xs font-medium text-white cursor-help whitespace-nowrap"
                  title={`Build date: ${BUILD_DATE}`}
                >
                  v{VERSION}
                </div>
              </div>
            )}

            {/* Collapsed view - Compact title */}
            {isHeaderCollapsed && (
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-white">🎲 Games</h1>
                <div
                  className="px-2 py-0.5 bg-white/20 border border-white/30 rounded-full text-[10px] font-medium text-white cursor-help whitespace-nowrap"
                  title={`Build date: ${BUILD_DATE}`}
                >
                  v{VERSION}
                </div>
                {/* v1.3.0: Needs Checking Priority Legend (staff-only) */}
                {isStaff && (
                  <div className="text-[9px] sm:text-[10px] text-white/70 whitespace-nowrap">
                    Priority: 🔴🟠🟡🟢🔵
                  </div>
                )}
              </div>
            )}

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = '/'}
                className="whitespace-nowrap h-8 text-xs text-white hover:bg-white/20 hover:text-white"
                title="Go to Home Page"
              >
                <Home className="h-4 w-4" />
                <span className="hidden md:inline ml-1.5">Home</span>
              </Button>
              {!isStaff && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStaffLogin(true)}
                  className="whitespace-nowrap h-8 text-xs bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white hover:border-white/50"
                >
                  <span className="hidden sm:inline">🔐 Staff</span>
                  <span className="sm:hidden">🔐</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAddGameDialog(true)}
                  className="whitespace-nowrap h-8 text-xs bg-secondary hover:bg-secondary/90 text-white"
                >
                  <Plus className="h-3 w-3" />
                  <span className="hidden md:inline ml-1.5">Add</span>
                </Button>
              )}
              {isStaff && <StaffMenu />}
            </div>
          </div>

          {/* Search and Filters Row - Part of unified header */}
          <div className="mt-3">
        {isHeaderCollapsed ? (
          // Collapsed view - search bar + slim bar with active filters
          <div className="space-y-2">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBar
                  value={filters.search || ''}
                  onChange={handleSearch}
                  placeholder="Search games..."
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleHeaderCollapse}
                title="Expand filters"
                className="h-9 w-9 p-0 flex-shrink-0 text-white hover:bg-white/20 hover:text-white"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter badges and results count */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-white/90 font-medium whitespace-nowrap">
                  {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
                </p>
              {hasAnyFilters && (
                <div className="flex items-center gap-1 flex-wrap">
                  {filters.search && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      🔍 {filters.search.length > 8 ? filters.search.substring(0, 8) + '...' : filters.search}
                    </span>
                  )}
                  {filters.quickFilter && (
                    <>
                      <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                        {filters.quickFilter === 'sixPlus' && '👥 6+ Players'}
                        {filters.quickFilter === 'couples' && '💑 Couples'}
                        {filters.quickFilter === 'social' && '🎉 Social'}
                        {filters.quickFilter === 'noChecks' && '📋 No Checks'}
                        {filters.quickFilter === 'hasIssues' && '⚠️ Has Issues'}
                      </span>
                      {/* Show what the special filter is actually doing */}
                      {filters.quickFilter === 'sixPlus' && (
                        <span className="text-[10px] sm:text-xs bg-white/70 text-foreground px-1.5 py-0.5 rounded whitespace-nowrap">
                          Max≥6
                        </span>
                      )}
                      {filters.quickFilter === 'couples' && (
                        <span className="text-[10px] sm:text-xs bg-white/70 text-foreground px-1.5 py-0.5 rounded whitespace-nowrap">
                          2p or Best@2
                        </span>
                      )}
                      {filters.quickFilter === 'social' && (
                        <span className="text-[10px] sm:text-xs bg-white/70 text-foreground px-1.5 py-0.5 rounded whitespace-nowrap">
                          Party/Deduction/Social
                        </span>
                      )}
                    </>
                  )}
                  {filters.categories && filters.categories.length > 0 && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      📁 {filters.categories.length}
                    </span>
                  )}
                  {(filters.playerCount?.min || filters.playerCount?.max) && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      🎲 {filters.playerCount?.min || '?'}-{filters.playerCount?.max || '?'}
                    </span>
                  )}
                  {(filters.yearRange?.min || filters.yearRange?.max) && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      📅 {filters.yearRange?.min || '?'}-{filters.yearRange?.max || '?'}
                    </span>
                  )}
                  {(filters.complexity?.min || filters.complexity?.max) && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      🧠 {filters.complexity?.min || '?'}-{filters.complexity?.max || '?'}
                    </span>
                  )}
                  {filters.playtime && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      ⏱️ {filters.playtime}m
                    </span>
                  )}
                  {filters.bestPlayerCount && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      ⭐ {filters.bestPlayerCount}
                    </span>
                  )}
                  {filters.exactPlayerCount && (
                    <span className="text-[10px] sm:text-xs bg-white/90 text-primary px-1.5 py-0.5 rounded whitespace-nowrap font-medium">
                      👥 {filters.exactPlayerCount}p
                    </span>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        ) : (
          // Expanded view - full header
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <SearchBar
                  value={filters.search || ''}
                  onChange={handleSearch}
                  placeholder="Search games..."
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleHeaderCollapse}
                title="Collapse filters"
                className="text-white hover:bg-white/20 hover:text-white"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile-optimized layout: Row 1 (Filters, Gallery, Random) → Row 2 (Sort + Staff Knowledge) */}
            <div className="space-y-2.5">
              {/* Row 1: Filter buttons - Filters, Gallery Mode, Random Pick */}
              <div className="flex flex-wrap gap-2 items-center">
                <GameFilters
                  filters={filters}
                  onQuickFilter={handleQuickFilter}
                  onOpenAdvancedFilter={() => setShowAdvancedFilters(true)}
                  onClearAll={handleClearAll}
                  activeFiltersCount={activeFiltersCount}
                  hasAnyFilters={hasAnyFilters}
                  isStaff={isStaff}
                />

                {/* v1.9.6: Exact Player Count dropdown */}
                <Select
                  value={filters.exactPlayerCount?.toString() || 'any'}
                  onValueChange={(value) => {
                    setFilters(prev => ({
                      ...prev,
                      exactPlayerCount: value === 'any' ? undefined : Number(value)
                    }));
                  }}
                >
                  <SelectTrigger className={`w-[140px] sm:w-[180px] ${filters.exactPlayerCount ? 'border-primary bg-primary/5' : ''}`}>
                    <SelectValue placeholder="Player Count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Players</SelectItem>
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

                <Button
                  variant={picturesOnlyMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setPicturesOnlyMode(!picturesOnlyMode)}
                  className={picturesOnlyMode ? 'bg-secondary hover:bg-secondary/90 text-white' : 'bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white hover:border-white/50'}
                >
                  <Images className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Gallery</span>
                  <span className="sm:hidden">📷</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRandomGame}
                  disabled={filteredAndSortedGames.length === 0}
                  className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white hover:border-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Random</span>
                  <span className="sm:hidden">🎲</span>
                </Button>
              </div>

              {/* Row 2: Sorting options - Sort dropdown + Staff Knowledge dropdowns */}
              <div className="flex flex-wrap gap-2 items-center">
                {/* Combined Sort Dropdown */}
                <Select
                  value={staffSortOption || sortOption}
                  onValueChange={(value: SortOption) => {
                    // Check if it's a staff-only sort option (v1.3.0: added needsChecking)
                    if (['needsChecking', 'lastChecked', 'lastCheckedDesc', 'totalChecks', 'totalChecksDesc'].includes(value)) {
                      setStaffSortOption(value);
                      setSortOption('dateAcquired'); // Reset regular sort to default
                    } else {
                      setSortOption(value);
                      setStaffSortOption(null); // Clear staff sort
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px] sm:w-[220px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dateAcquired">Date Acquired</SelectItem>
                    <SelectItem value="alphabetical">A-Z</SelectItem>
                    <SelectItem value="alphabeticalDesc">Z-A</SelectItem>
                    <SelectItem value="year">Year Released</SelectItem>
                    <SelectItem value="maxPlayers">Max Players</SelectItem>
                    <SelectItem value="complexity">Complexity</SelectItem>
                    {isStaff && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <SelectItem value="needsChecking">📚 Needs Checking</SelectItem>
                        <SelectItem value="lastChecked">Last Checked (Recent)</SelectItem>
                        <SelectItem value="lastCheckedDesc">Last Checked (Oldest)</SelectItem>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <SelectItem value="totalChecks">Total Checks (Most)</SelectItem>
                        <SelectItem value="totalChecksDesc">Total Checks (Least)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>

                {isStaff && (
                  <>
                    {/* Visual separator and label for Staff Knowledge Filters */}
                    <div className="h-6 w-px bg-border mx-2 hidden sm:block" />
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap hidden sm:inline">
                      Staff Knowledge:
                    </span>

                    <Select
                      value={selectedStaffFilter}
                      onValueChange={(value: string) => {
                        console.log('🔍 Staff filter changed to:', value);
                        setSelectedStaffFilter(value);
                      }}
                    >
                      <SelectTrigger className="w-[140px] sm:w-[180px]">
                        <SelectValue placeholder="All Staff" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Staff</SelectItem>
                        {(() => {
                          const currentStaffName = localStorage.getItem('staff_name');
                          const currentStaffId = localStorage.getItem('staff_id');

                          // Validate current staff UUID
                          const isValidUUID = currentStaffId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentStaffId);

                          // Filter out staff with invalid UUIDs and exclude current user
                          const otherStaff = staffList
                            .filter(s => {
                              const hasValidId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id);
                              return hasValidId && s.id !== currentStaffId && s.name;
                            })
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                          return (
                            <>
                              {isValidUUID && currentStaffName && (
                                <SelectItem value={currentStaffId}>{currentStaffName} (Me)</SelectItem>
                              )}
                              {otherStaff.map(staff => (
                                <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                              ))}
                            </>
                          );
                        })()}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedKnowledgeFilter}
                      onValueChange={(value: string) => setSelectedKnowledgeFilter(value)}
                    >
                      <SelectTrigger className="w-[160px] sm:w-[200px]">
                        <SelectValue placeholder="All Levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="none">No Knowledge Records</SelectItem>
                        <SelectItem value="beginner-intermediate">Beginner + Intermediate</SelectItem>
                        <SelectItem value="expert-instructor">Expert + Instructor</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>

            {/* Results count */}
            <p className="text-xs sm:text-sm text-white/90 font-medium">
              {filteredAndSortedGames.length} {filteredAndSortedGames.length === 1 ? 'game' : 'games'}
            </p>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Games Grid - reduced top padding */}
      <div className="container mx-auto px-4 py-4 max-w-full">
      {picturesOnlyMode ? (
        // Pictures Only Mode - 3 column grid with just images
        <div className="grid grid-cols-3 gap-2 pt-4">
          {filteredAndSortedGames.map((game) => {
            // Support both PostgreSQL (game.images) and Airtable (game.fields.Images) structures
            const images = game.images || game.fields.Images || [];
            const firstImage = images[0];

            // For PostgreSQL images, use hash-based route; for Airtable, use proxy
            const imageHash = firstImage && 'hash' in firstImage ? firstImage.hash : undefined;
            const originalImageUrl = firstImage && 'thumbnails' in firstImage
              ? (firstImage.thumbnails?.large?.url || firstImage.url)
              : firstImage?.url;
            const imageUrl = imageHash
              ? `/api/images/${imageHash}`
              : originalImageUrl
                ? `/api/images/proxy?url=${encodeURIComponent(originalImageUrl)}`
                : undefined;

            // Log missing hashes for debugging
            if (!imageHash && originalImageUrl) {
              console.warn(`[Gallery] Game "${game.fields['Game Name']}" missing image hash, falling back to proxy:`, originalImageUrl);
            }

            return (
              <div
                key={game.id}
                className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group"
                onClick={() => {
                  setPicturesOnlyMode(false);
                  setSelectedGame(game);
                }}
              >
                {imageUrl ? (
                  <>
                    {/* Blurred background */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(10px)',
                        zIndex: 0
                      }}
                    />
                    {/* Sharp image */}
                    <img
                      src={imageUrl}
                      alt={game.fields['Game Name']}
                      className="w-full h-full object-contain relative z-10"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Normal Mode - 5 column grid with cards
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 pt-4">
          {filteredAndSortedGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => handleGameCardClick(game)}
              isStaff={isStaff}
              picturesOnlyMode={picturesOnlyMode}
              staffKnowledgeLevel={staffKnowledge.get(game.id)?.confidenceLevel}
              onKnowledgeBadgeClick={() => handleKnowledgeBadgeClick(game)} // v1.2.0
              staffId={staffId || undefined} // v1.5.0: Pass staffId for issue reporting
            />
          ))}
        </div>
      )}

      {/* No results */}
      {filteredAndSortedGames.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No games found matching your criteria</p>
        </div>
      )}
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        open={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        filters={filters}
        onApplyFilters={handleApplyAdvancedFilters}
        availableCategories={categories}
      />

      {/* Spinner Wheel */}
      <SpinnerWheel
        games={spinnerGames}
        open={showSpinner}
        onClose={() => setShowSpinner(false)}
        onComplete={handleSpinnerComplete}
      />

      {/* Game Detail Modal */}
      <GameDetailModal
        game={selectedGame}
        open={!!selectedGame}
        onClose={handleCloseModal}
        onRefresh={handleRefresh}
        staffKnowledge={selectedGame ? staffKnowledge.get(selectedGame.id) : undefined}
      />

      {/* Add Game Dialog (Staff Only) */}
      {isStaff && (
        <AddGameDialog
          open={showAddGameDialog}
          onClose={() => setShowAddGameDialog(false)}
          onSuccess={() => fetchGames()}
        />
      )}

      {/* Staff Login Dialog */}
      <StaffLoginDialog
        isOpen={showStaffLogin}
        onClose={() => setShowStaffLogin(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* v1.2.0: Knowledge Dialog for editing existing knowledge */}
      {knowledgeDialogGame && (
        <AddGameKnowledgeDialog
          isOpen={showKnowledgeDialog}
          onClose={() => {
            setShowKnowledgeDialog(false);
            setKnowledgeDialogGame(null);
          }}
          gameId={knowledgeDialogGame.id}
          gameName={knowledgeDialogGame.fields['Game Name']}
          onSuccess={handleRefresh}
          existingKnowledgeId={staffKnowledge.get(knowledgeDialogGame.id)?.id}
          existingConfidenceLevel={staffKnowledge.get(knowledgeDialogGame.id)?.confidenceLevel}
          existingNotes={staffKnowledge.get(knowledgeDialogGame.id)?.notes || ""}
        />
      )}

      {/* Floating Back to Top Button */}
      <ScrollToTopButton />
    </div>
  );
}

export default function GamesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <GamesPageContent />
    </Suspense>
  );
}
