// Board Game Types
export interface BoardGame {
  id: string;
  // Images from PostgreSQL (top-level property)
  images?: Array<{
    id?: string;
    url: string;
    fileName: string;
    hash: string;
  }>;
  fields: {
    'Game Name': string;
    Categories?: string[];
    Mechanisms?: string[];
    Images?: Array<{
      id: string;
      url: string;
      filename: string;
      size: number;
      type: string;
      thumbnails?: {
        small: { url: string; width: number; height: number };
        large: { url: string; width: number; height: number };
        full: { url: string; width: number; height: number };
      };
    }>;
    'Year Released'?: number;
    'Complexity'?: number;
    'Min Players'?: string;  // Changed from number to string (singleSelect in Airtable)
    'Max. Players'?: string;  // Changed from number to string (singleSelect in Airtable)
    'Min Playtime'?: number;  // Playtime in minutes
    'Max Playtime'?: number;  // Playtime in minutes
    Description?: string;
    'Date of Aquisition'?: string;
    'Best Player Amount'?: string;
    'Age Tag'?: string;
    'SNP Popularity'?: number;
    // Content Check fields
    'Sleeved'?: boolean;
    'Box Wrapped'?: boolean;
    'Latest Check Date'?: string;
    'Latest Check Status'?: string[];
    'Latest Check Notes'?: string[];
    'Total Checks'?: number;
    'All Content Checks'?: string[];
    // Expansion fields
    'Expansion'?: boolean;
    'Base Game'?: string[]; // Link to base game record
    'Base Game ID'?: string; // Direct ID reference to base game (for expansions)
    'Game Expansions Link'?: string[]; // Link to expansion records (for base games)
    // Financial and rental fields
    'Deposit'?: number;
    'Cost Price'?: number;
    'Game Size'?: string; // Size category: "1", "2", "3", "4", "5"
  };
}

// Content Check Types
export interface ContentCheck {
  id: string;
  fields: {
    'Record ID': string;
    'Board Game'?: string[];
    'Check Date'?: string;
    'Inspector'?: string[];
    'Status': 'Perfect Condition' | 'Minor Issues' | 'Major Issues' | 'Unplayable';
    'Missing Pieces'?: string;
    'Box Condition'?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged';
    'Card Condition'?: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged';
    'Is Fake'?: boolean;
    'Notes'?: string;
    'Sleeved At Check'?: boolean;
    'Box Wrapped At Check'?: boolean;
    'Photos'?: Array<{
      id: string;
      url: string;
      filename: string;
      size: number;
      type: string;
      thumbnails?: {
        small: { url: string; width: number; height: number };
        large: { url: string; width: number; height: number };
        full: { url: string; width: number; height: number };
      };
    }>;
  };
}

// User/Customer Types
export interface Customer {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  membershipLevel?: 'regular' | 'premium' | 'vip';
  totalVisits?: number;
  joinDate?: string;
  preferences?: {
    favoriteGames?: string[];
    preferredLanguage?: 'en' | 'vi';
  };
}

// Booking Types
export interface Booking {
  id: string;
  customerId: string;
  date: string;
  time: string;
  guestCount: number;
  gameType: 'board' | 'video' | 'unsure';
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  privateRoom?: boolean;
}

// Event Types
export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  capacity: number;
  registeredCount: number;
  imageUrl?: string;
  facebookEventId?: string;
  registrations?: EventRegistration[];
  pastPhotos?: string[];
}

export interface EventRegistration {
  id: string;
  eventId: string;
  customerName: string;
  customerId?: string;
  registeredAt: string;
  guestCount: number;
}

// Discord Update Types
export interface DiscordUpdate {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  attachments?: string[];
}

// Filter Types for Board Games
export interface GameFilters {
  search?: string;
  categories?: string[];
  categoryMatchMode?: 'AND' | 'OR';
  yearRange?: { min?: number; max?: number };
  playerCount?: { min?: number; max?: number };
  complexity?: { min?: number; max?: number };
  playtime?: number; // Filter by single playtime value (shows games that fit within this time)
  quickFilter?: 'sixPlus' | 'couples' | 'social' | 'noChecks';
  bestPlayerCount?: number;
}

export type SortOption = 'alphabetical' | 'alphabeticalDesc' | 'year' | 'maxPlayers' | 'complexity' | 'dateAcquired' | 'lastChecked' | 'lastCheckedDesc' | 'totalChecks' | 'totalChecksDesc';

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// BoardGameGeek API Types
export interface BGGGameData {
  id: number;
  name: string;
  description: string;
  yearPublished: number;
  minPlayers: number;
  maxPlayers: number;
  bestPlayerCount?: number;
  playingTime: number;
  minPlaytime: number;
  maxPlaytime: number;
  minAge: number;
  complexity: number; // Weight/complexity rating (1-5)
  categories: string[];
  mechanisms: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  allImages?: string[];
  isExpansion: boolean;
  expandsGameId?: number;
  expandsGameName?: string;
}

// Create Game Input Types
export interface CreateGameInput {
  bggId: number;
  costPrice?: number;
  gameSize?: string;
  deposit?: number;
  dateOfAcquisition: string;
  isExpansion: boolean;
  baseGameId?: string;
  selectedImages?: {
    boxImage: string;
    gameplayImage?: string;
  };
  customImageUrls?: string[]; // Additional custom image URLs
}

// Changelog Types
export interface ChangelogEntry {
  id: string;
  event_type: 'created' | 'updated' | 'deleted' | 'photo_added';
  category: 'board_game' | 'play_log' | 'staff_knowledge' | 'content_check';
  entity_id: string;
  entity_name: string;
  description: string;
  staff_member: string;
  staff_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ChangelogFilters {
  startDate: string;
  endDate: string;
  staffId: string | null;
  eventType: string | null;
  category: string | null;
  myChangesOnly: boolean;
}

export interface ChangelogStats {
  totalChanges: number;
  gameUpdates: number;
  playLogsAdded: number;
  knowledgeUpdates: number;
  contentChecks: number;
}

export interface ChangelogChartData {
  changesByDay: Array<{
    date: string;
    created: number;
    updated: number;
    deleted: number;
    photo_added: number;
  }>;
  changesByCategory: {
    board_game: number;
    play_log: number;
    staff_knowledge: number;
    content_check: number;
  };
  changesByStaff: Array<{
    staffName: string;
    totalChanges: number;
  }>;
  changesByStaffOverTime?: Array<{
    date: string;
    staffId: string;
    staffName: string;
    totalActions: number;
  }>;
  staffKnowledgeCounts?: Array<{
    staffName: string;
    knowledgeCount: number;
  }>;
  weightedContributions?: Array<{
    staffName: string;
    contentChecks: number;
    photos: number;
    playLogs: number;
    totalScore: number;
  }>;
}

// Analytics Insights Types
export interface AnalyticsInsights {
  gamesNeedingAttention: {
    count: number;
    percentage: string;
    games: Array<{
      id: string;
      name: string;
      lastCheckDate: string | null;
      daysSinceCheck: number;
    }>;
  };
  underutilizedGames: {
    count: number;
    percentage: string;
    games: Array<{
      id: string;
      name: string;
      dateAcquired: string | null;
    }>;
  };
  knowledgeCoverage: {
    gamesWithKnowledge: number;
    totalGames: number;
    percentage: string;
    staffFiltered?: boolean; // True if filtered by specific staff member
  };
  teachingCapacity: Array<{
    staffName: string;
    canTeachCount: number;
    ranking: number;
  }>;
  staffSpecialization: Array<{
    staffName: string;
    topCategories: Array<{
      category: string;
      count: number;
    }>;
  }>;
  acquisitionTrends: Array<{
    period: string;
    count: number;
  }>;
}
