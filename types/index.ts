// Board Game Types
export interface BoardGame {
  id: string;
  fields: {
    'Game Name': string;
    Categories?: string[];
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
    'Complexity / Difficulty'?: number;
    'Min Players (BG)'?: number;
    'Max. Players (BG)'?: number;
    Description?: string;
    'Date of Acquisition'?: string;
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
  yearRange?: { min?: number; max?: number };
  playerCount?: { min?: number; max?: number };
  complexity?: { min?: number; max?: number };
  quickFilter?: 'sixPlus' | 'couples' | 'party';
}

export type SortOption = 'alphabetical' | 'year' | 'maxPlayers' | 'complexity' | 'dateAcquired';

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}