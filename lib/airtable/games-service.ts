import Airtable from 'airtable';
import { BoardGame, GameFilters, SortOption } from '@/types';

class GamesService {
  private base: Airtable.Base;
  private tableId: string;
  private viewId: string;

  constructor() {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
      throw new Error('Airtable configuration missing');
    }

    const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
    this.base = airtable.base(process.env.AIRTABLE_BASE_ID);
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
            games.push({
              id: record.id,
              fields: {
                'Game Name': record.get('Game Name') as string,
                'Categories': record.get('Categories') as string[] || [],
                'Images': record.get('Images') as any || [],
                'Year Released': record.get('Year Released') as number,
                'Complexity / Difficulty': record.get('Complexity / Difficulty') as number,
                'Min Players (BG)': record.get('Min Players (BG)') as number,
                'Max. Players (BG)': record.get('Max. Players (BG)') as number,
                'Description': record.get('Description') as string,
                'Date of Acquisition': record.get('Date of Acquisition') as string,
              },
            });
          });
          fetchNextPage();
        });

      return games;
    } catch (error) {
      console.error('Error fetching games:', error);
      throw new Error('Failed to fetch games from Airtable');
    }
  }

  async getGameById(id: string): Promise<BoardGame | null> {
    try {
      const record = await this.base(this.tableId).find(id);

      return {
        id: record.id,
        fields: {
          'Game Name': record.get('Game Name') as string,
          'Categories': record.get('Categories') as string[] || [],
          'Images': record.get('Images') as any || [],
          'Year Released': record.get('Year Released') as number,
          'Complexity / Difficulty': record.get('Complexity / Difficulty') as number,
          'Min Players (BG)': record.get('Min Players (BG)') as number,
          'Max. Players (BG)': record.get('Max. Players (BG)') as number,
          'Description': record.get('Description') as string,
          'Date of Acquisition': record.get('Date of Acquisition') as string,
        },
      };
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
        const minPlayers = game.fields['Min Players (BG)'];
        const maxPlayers = game.fields['Max. Players (BG)'];

        if (filters.playerCount!.min && maxPlayers && maxPlayers < filters.playerCount!.min) return false;
        if (filters.playerCount!.max && minPlayers && minPlayers > filters.playerCount!.max) return false;
        return true;
      });
    }

    // Complexity filter
    if (filters.complexity) {
      filtered = filtered.filter(game => {
        const complexity = game.fields['Complexity / Difficulty'];
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
            (game.fields['Max. Players (BG)'] || 0) >= 6
          );
          break;
        case 'couples':
          filtered = filtered.filter(game =>
            game.fields['Min Players (BG)'] === 2 &&
            game.fields['Max. Players (BG)'] === 2
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
          const maxA = a.fields['Max. Players (BG)'] || 0;
          const maxB = b.fields['Max. Players (BG)'] || 0;
          if (maxA !== maxB) return maxB - maxA;
          // Secondary sort by acquisition date
          return this.compareAcquisitionDates(b, a);
        });
        break;

      case 'complexity':
        sorted.sort((a, b) => {
          const compA = a.fields['Complexity / Difficulty'] || 0;
          const compB = b.fields['Complexity / Difficulty'] || 0;
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
    const dateA = a.fields['Date of Acquisition'];
    const dateB = b.fields['Date of Acquisition'];

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