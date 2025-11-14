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

// Video Game Types
export type VideogamePlatform = 'switch' | 'ps5' | 'xbox' | 'wii' | 'wiiu' | 'ps4' | 'xboxone';

export interface VideoGame {
  id: string; // Platform-specific ID (e.g., TitleID for Switch)
  platform: VideogamePlatform;
  name: string;
  publisher?: string;
  developer?: string;
  release_date?: number; // YYYYMMDD format
  description?: string;
  category?: string[]; // Genres
  languages?: string[];
  number_of_players?: number;
  age_rating?: number; // ESRB age rating (6=E, 10=E10+, 13=T, 17=M)
  rating_content?: string[]; // ESRB/PEGI content descriptors
  platform_specific_data?: Record<string, any>; // Flexible field for platform-unique data
  located_on?: string[]; // Physical console locations (e.g., ["Samus", "Toad"])
  image_url?: string; // Deprecated, kept for compatibility
  image_landscape_url?: string; // 16:9 landscape cover (hero image)
  image_portrait_url?: string; // Portrait box art
  image_screenshot_url?: string; // In-game screenshot
  created_at?: string;
  updated_at?: string;
}

// Video Game Filter Types
export interface VideoGameFilters {
  search?: string;
  platform?: VideogamePlatform[];
  locatedOn?: string[]; // Filter by console location
  category?: string[]; // Filter by genre
  ageRating?: number[]; // Filter by ESRB age rating (6, 10, 13, 17)
  players?: { min?: number; max?: number };
  yearRange?: { min?: number; max?: number };
  ratingContent?: string[]; // Filter by rating content
}

export type VideoGameSortOption =
  | 'alphabetical'
  | 'alphabeticalDesc'
  | 'releaseDate'
  | 'releaseDateDesc'
  | 'players';

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
  quickFilter?: 'sixPlus' | 'couples' | 'social' | 'noChecks' | 'hasIssues'; // v1.2.0: Added hasIssues
  bestPlayerCount?: number;
  exactPlayerCount?: number; // v1.9.6: Exact player count filter (shows games playable with this exact number)
}

export type SortOption = 'alphabetical' | 'alphabeticalDesc' | 'year' | 'maxPlayers' | 'complexity' | 'dateAcquired' | 'lastChecked' | 'lastCheckedDesc' | 'totalChecks' | 'totalChecksDesc' | 'needsChecking';

// v1.3.0: Needs Checking criteria metadata
export interface NeedsCheckingInfo {
  needsChecking: boolean;
  criterion: 1 | 2 | 3 | 4 | 5 | null; // Priority level (1=highest, 5=lowest)
  criterionLabel: string; // Human-readable label (e.g., "🔴 Urgent - Recently played")
  criterionColor: '🔴' | '🟠' | '🟡' | '🟢' | '🔵' | null; // Color emoji indicator
  recentPlays: number; // Plays in last 30 days
  totalPlays: number; // Total play count
  playsSinceLastCheck: number; // Plays since most recent check
  lastPlayedDate: Date | null; // Most recent play log date
  daysSinceLastCheck: number; // Days since last check (Infinity if never checked)
  daysSinceAcquired: number; // Days since acquisition
  sortPriority: number; // Composite score for sorting within criterion
}

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
  // BGG import mode (when bggId is provided)
  bggId?: number;

  // Manual entry mode (when manualEntry is provided)
  manualEntry?: {
    name: string;
    yearPublished: number;
    minPlayers: number;
    maxPlayers: number;
    playingTime: number;
    minPlaytime: number;
    maxPlaytime: number;
    minAge: number;
    description: string;
    complexity: number;
    bestPlayerCount: number;
    categories: string[];
    mechanisms: string[];
  };

  // Shared fields
  costPrice?: number;
  gameSize?: string;
  deposit?: number;
  dateOfAcquisition: string;
  isExpansion: boolean;
  baseGameId?: string;

  // Image fields
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
  category: 'board_game' | 'play_log' | 'staff_knowledge' | 'content_check' | 'task' | 'issue_report';
  entity_id: string;
  entity_name: string;
  description: string;
  staff_member: string;
  staff_id: string;
  staff_name?: string; // From LEFT JOIN with staff_list
  staff_email?: string; // From LEFT JOIN with staff_list
  metadata?: Record<string, any>;
  points_awarded?: number | null;
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
  pointsEarned?: number; // v1.6.8: Replace gameUpdates with pointsEarned
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
  // v1.5.9: Points analytics
  cumulativePoints?: Array<{
    date: string;
    staff_id: string;
    nickname: string;
    full_name: string;
    daily_points: number;
    cumulative_points: number;
  }>;
  totalPointsByStaff?: Array<{
    nickname: string;
    full_name: string;
    total_points: number;
  }>;
  pointsByCategory?: Array<{
    category: string;
    total_points: number;
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

// ========================================
// Rostering System Types (v2.0.0)
// ========================================

// Staff List Extensions
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  nickname?: string;
  points?: number;
  vikunja_user_id?: number;
  vikunja_username?: string;
  // Rostering v2.0.0 additions
  base_hourly_rate?: number; // VND hourly rate
  discord_username?: string;
  has_keys?: boolean;
  available_roles?: string[]; // ['Dealer', 'Senior', 'BG Master']
}

// Roster Shifts
export type ShiftType = 'opening' | 'day' | 'evening' | 'closing';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface RosterShift {
  id: string;
  roster_week_start: string; // DATE
  day_of_week: DayOfWeek;
  shift_type: ShiftType;
  staff_id: string;
  scheduled_start: string; // TIME
  scheduled_end: string; // TIME
  role_required: string;
  shift_notes?: string;
  clock_in_reminder?: string;
  created_at: string;
  updated_at: string;
}

// Staff Availability
export type AvailabilityStatus = 'available' | 'preferred_not' | 'unavailable';

export interface StaffAvailability {
  id: string;
  staff_id: string;
  day_of_week: DayOfWeek;
  hour_start: number; // 0-23
  hour_end: number; // 0-23
  availability_status: AvailabilityStatus;
  created_at: string;
  updated_at: string;
}

// Roster Rules
export type RuleType =
  | 'min_staff'
  | 'max_staff'
  | 'staff_hours'
  | 'avoid_pairing'
  | 'role_required'
  | 'date_specific';

export interface RosterRule {
  id: string;
  rule_text: string; // Natural language
  parsed_constraint: {
    type: RuleType;
    parameters: Record<string, any>;
  };
  weight: number; // 0-100
  is_active: boolean;
  expires_at?: string; // DATE
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Clock Records
export interface ClockRecord {
  id: string;
  staff_id: string;
  shift_id?: string;
  clock_in_time: string; // TIMESTAMP
  clock_out_time?: string; // TIMESTAMP
  clock_in_location?: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  clock_out_location?: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  rostered_start?: string; // TIME
  rostered_end?: string; // TIME
  variance_reason?: string;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: string;
  approved_hours?: number;
  points_awarded: number;
  created_at: string;
}

// Shift Swaps
export type ShiftSwapStatus = 'pending' | 'auto_approved' | 'admin_approved' | 'vetoed';

export interface ShiftSwap {
  id: string;
  shift_id: string;
  requesting_staff_id: string;
  target_staff_id: string;
  status: ShiftSwapStatus;
  reason?: string;
  requested_at: string;
  resolved_at?: string;
  resolved_by?: string;
  notes?: string;
}

// Roster Notifications
export type RosterNotificationType =
  | 'late_clock_in'
  | 'shift_swap'
  | 'hour_adjustment'
  | 'missing_clock_out'
  | 'rule_expired'
  | 'unscheduled_clock_in'
  | 'availability_conflict';

export type NotificationSeverity = 'info' | 'warning' | 'requires_action';

export interface RosterNotification {
  id: string;
  notification_type: RosterNotificationType;
  staff_id?: string;
  related_record_id?: string;
  message: string;
  severity: NotificationSeverity;
  is_cleared: boolean;
  created_at: string;
  cleared_at?: string;
}

// Roster Holidays
export interface RosterHoliday {
  id: string;
  holiday_name: string;
  start_date: string; // DATE
  end_date: string; // DATE
  pay_multiplier: 2.0 | 3.0;
  created_at: string;
  updated_at: string;
}

// Pay Adjustments
export type PayAdjustmentType = 'commission' | 'bonus' | 'deduction';

export interface PayAdjustment {
  id: string;
  staff_id: string;
  adjustment_date: string; // DATE
  adjustment_type: PayAdjustmentType;
  amount: number; // VND
  reason: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Store Notifications
export interface StoreNotification {
  id: string;
  notification_text: string;
  target_staff: 'all_staff' | 'specific_staff';
  start_date: string; // DATE
  end_date: string; // DATE
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Pay Calculation Types
export interface PayBreakdown {
  regular: number;
  weekend: number;
  overtime: number;
  weekend_overtime: number;
  holiday: number;
}

export interface PayCalculation {
  breakdown: PayBreakdown;
  adjustments: PayAdjustment[];
  total: number;
}

// Roster Generation Types
export interface RosterGenerationInput {
  weekStart: string; // DATE
  duration: 1 | 2; // weeks
  staffList: StaffMember[];
  availability: StaffAvailability[];
  rules: RosterRule[];
}

export interface RosterGenerationResult {
  success: boolean;
  roster?: RosterShift[];
  ruleSatisfaction?: {
    percentage: number;
    metRules: number;
    totalRules: number;
    violatedRules?: Array<{
      rule: RosterRule;
      reason: string;
    }>;
  };
  error?: string;
  conflicts?: string[];
}

// Clock-in/out Flow Types
export interface ClockInRequest {
  staff_id: string;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
  };
}

export interface ClockOutRequest {
  staff_id: string;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  reason?: string;
  actual_end_time?: string; // For "forgot to clock out"
}

export interface ClockInResponse {
  success: boolean;
  clock_record: ClockRecord;
  variance_minutes: number;
  points_awarded: number;
  reminders: Array<{
    type: 'vikunja_task' | 'store_notice' | 'shift_note';
    text: string;
    link?: string;
  }>;
  prompt?: {
    type: 'on_time' | 'early' | 'late_warning' | 'late_explanation_required';
    message: string;
  };
}

// Admin Dashboard Types
export interface RosterDashboardStats {
  pendingApprovals: number;
  activeNotifications: number;
  weeklyHours: number;
  upcomingRosterStatus: 'published' | 'draft' | 'not_created';
}

// Approval Queue Types
export interface ApprovalQueueItem {
  clockRecord: ClockRecord;
  staffMember: StaffMember;
  shift?: RosterShift;
  varianceMinutes: {
    clockIn: number;
    clockOut: number;
  };
  calculatedPay: PayCalculation;
}
