import Airtable from 'airtable';
import { BoardGame, GameFilters, SortOption } from '@/types';

class GamesService {
  private base: Airtable.Base;
  private tableId: string;
  private viewId: string;

  constructor() {
    // Use fallback values if environment variables are not set
    const apiKey = process.env.AIRTABLE_API_KEY || '';
    const baseId = process.env.AIRTABLE_GAMES_BASE_ID || 'apppFvSDh2JBc0qAu';

    if (!apiKey) {
      console.warn('Warning: AIRTABLE_API_KEY is not set');
    }

    const airtable = new Airtable({ apiKey });
    this.base = airtable.base(baseId);
    this.tableId = process.env.AIRTABLE_GAMES_TABLE_ID || 'tblIuIJN5q3W6oXNr';
    this.viewId = process.env.AIRTABLE_GAMES_VIEW_ID || 'viwHMUIuvp0H2S1vE';
  }

  async getAllGames(): Promise<BoardGame[]> {
    try {
      const games: BoardGame[] = [];

      await this.base(this.tableId)
        .select({
          view: this.viewId,
        })
        .eachPage((records, fetchNextPage) => {
          records.forEach((record) => {
            games.push(this.mapRecordToGame(record));
          });
          fetchNextPage();
        });

      return games;
    } catch (error) {
      console.error('Error fetching games:', error);
      throw new Error('Failed to fetch games from Airtable');
    }
  }

  async getUpdatedGames(since: string): Promise<BoardGame[]> {
    try {
      const games: BoardGame[] = [];
      const filterFormula = `IS_AFTER({Last Modified}, '${since}')`;

      console.log(`Fetching games modified since: ${since}`);

      await this.base(this.tableId)
        .select({
          filterByFormula: filterFormula,
          view: this.viewId,
        })
        .eachPage((records, fetchNextPage) => {
          records.forEach((record) => {
            games.push(this.mapRecordToGame(record));
          });
          fetchNextPage();
        });

      console.log(`Found ${games.length} updated games`);
      return games;
    } catch (error) {
      console.error('Error fetching updated games:', error);
      throw new Error('Failed to fetch updated games from Airtable');
    }
  }

  private mapRecordToGame(record: any): BoardGame {
    return {
      id: record.id,
      fields: {
        'Game Name': record.get('Game Name') as string,
        'Categories': record.get('Categories') as string[] || [],
        'Images': record.get('Images') as any || [],
        'Year Released': record.get('Year Released') as number,
        'Complexity': record.get('Complexity') as number,
        'Min Players': record.get('Min Players') as string,
        'Max. Players': record.get('Max. Players') as string,
        'Description': record.get('Description') as string,
        'Date of Aquisition': record.get('Date of Aquisition') as string,
        'Best Player Amount': record.get('Best Player Amount') as string,
        'Age Tag': record.get('Age Tag') as string,
        'SNP Popularity': record.get('SNP Popularity') as number,
        'Latest Check Date': record.get('Latest Check Date') as string,
        'Latest Check Status': record.get('Latest Check Status') as string[],
        'Latest Check Notes': record.get('Latest Check Notes') as string[],
        'Total Checks': record.get('Total Checks') as number,
        'Sleeved': record.get('Sleeved') as boolean,
        'Box Wrapped': record.get('Box Wrapped') as boolean,
        // Expansion fields
        'Expansion': record.get('Expansion') as boolean,
        'Base Game': record.get('Base Game') as string[],
        'Game Expansions Link': record.get('Game Expansions Link') as string[],
      },
    };
  }

  async getGameById(id: string): Promise<BoardGame | null> {
    try {
      const record = await this.base(this.tableId).find(id);
      return this.mapRecordToGame(record);
    } catch (error) {
      console.error('Error fetching game by ID:', error);
      return null;
    }
  }

  filterGames(games: BoardGame[], filters: GameFilters): BoardGame[] {
    let filtered = [...games];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(game =>
        game.fields['Game Name'].toLowerCase().includes(searchLower) ||
        game.fields.Description?.toLowerCase().includes(searchLower)
      );
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter(game => {
        const gameCategories = game.fields.Categories || [];
        return filters.categories!.some(cat => gameCategories.includes(cat));
      });
    }

    // Year range filter
    if (filters.yearRange) {
      filtered = filtered.filter(game => {
        const year = game.fields['Year Released'];
        if (!year) return false;
        if (filters.yearRange!.min && year < filters.yearRange!.min) return false;
        if (filters.yearRange!.max && year > filters.yearRange!.max) return false;
        return true;
      });
    }

    // Player count filter
    if (filters.playerCount) {
      filtered = filtered.filter(game => {
        const minPlayers = game.fields['Min Players'];
        const maxPlayers = game.fields['Max. Players'];

        if (filters.playerCount!.min && maxPlayers && maxPlayers < filters.playerCount!.min) return false;
        if (filters.playerCount!.max && minPlayers && minPlayers > filters.playerCount!.max) return false;
        return true;
      });
    }

    // Complexity filter
    if (filters.complexity) {
      filtered = filtered.filter(game => {
        const complexity = game.fields['Complexity'];
        if (!complexity) return false;
        if (filters.complexity!.min && complexity < filters.complexity!.min) return false;
        if (filters.complexity!.max && complexity > filters.complexity!.max) return false;
        return true;
      });
    }

    // Quick filters
    if (filters.quickFilter) {
      switch (filters.quickFilter) {
        case 'sixPlus':
          filtered = filtered.filter(game =>
            (game.fields['Max. Players'] || 0) >= 6
          );
          break;
        case 'couples':
          filtered = filtered.filter(game =>
            game.fields['Min Players'] === 2 &&
            game.fields['Max. Players'] === 2
          );
          break;
        case 'party':
          filtered = filtered.filter(game => {
            const categories = game.fields.Categories || [];
            return categories.some(cat =>
              cat.toLowerCase().includes('party') ||
              cat.toLowerCase().includes('social')
            );
          });
          break;
      }
    }

    return filtered;
  }

  sortGames(games: BoardGame[], sortOption: SortOption): BoardGame[] {
    const sorted = [...games];

    switch (sortOption) {
      case 'alphabetical':
        sorted.sort((a, b) =>
          a.fields['Game Name'].localeCompare(b.fields['Game Name'])
        );
        break;

      case 'year':
        sorted.sort((a, b) => {
          const yearA = a.fields['Year Released'] || 0;
          const yearB = b.fields['Year Released'] || 0;
          if (yearA !== yearB) return yearB - yearA;
          // Secondary sort by acquisition date
          return this.compareAcquisitionDates(b, a);
        });
        break;

      case 'maxPlayers':
        sorted.sort((a, b) => {
          const maxA = a.fields['Max. Players'] || 0;
          const maxB = b.fields['Max. Players'] || 0;
          if (maxA !== maxB) return maxB - maxA;
          // Secondary sort by acquisition date
          return this.compareAcquisitionDates(b, a);
        });
        break;

      case 'complexity':
        sorted.sort((a, b) => {
          const compA = a.fields['Complexity'] || 0;
          const compB = b.fields['Complexity'] || 0;
          if (compA !== compB) return compB - compA;
          // Secondary sort by acquisition date
          return this.compareAcquisitionDates(b, a);
        });
        break;

      case 'dateAcquired':
      default:
        sorted.sort((a, b) => this.compareAcquisitionDates(b, a));
        break;
    }

    return sorted;
  }

  private compareAcquisitionDates(a: BoardGame, b: BoardGame): number {
    const dateA = a.fields['Date of Aquisition'];
    const dateB = b.fields['Date of Aquisition'];

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return new Date(dateA).getTime() - new Date(dateB).getTime();
  }

  getRandomGame(games: BoardGame[]): BoardGame | null {
    if (games.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * games.length);
    return games[randomIndex];
  }

  getAllCategories(games: BoardGame[]): string[] {
    const categoriesSet = new Set<string>();

    games.forEach(game => {
      const categories = game.fields.Categories || [];
      categories.forEach(cat => categoriesSet.add(cat));
    });

    return Array.from(categoriesSet).sort();
  }
}

export const gamesService = new GamesService();