import { create } from 'zustand';
import api from '../api/client';

const TRENDING_CACHE_TTL = 120000; // 2 minutes
const SEARCH_CACHE_TTL = 60000; // 1 minute
const MAX_RECENT_SEARCHES = 10;
const RECENT_SEARCHES_KEY = 'recentSearches';

// Search result cache
const searchCache = new Map();

// Load recent searches from localStorage
const loadRecentSearches = () => {
  try {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// Save recent searches to localStorage
const saveRecentSearches = (searches) => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Ignore storage errors
  }
};

export const useSearchStore = create((set, get) => ({
  // === STATE ===
  results: [],
  categories: { stocks: 0, etps: 0 },
  totalMatches: 0,
  isSearching: false,
  searchError: null,
  searchQuery: '',
  searchMode: 'symbol', // 'symbol' | 'keyword'
  typeFilter: '', // '' | 'Common Stock' | 'ETP'

  // Suggestions
  suggestions: [],
  suggestionHint: '',

  // Trending
  trending: null, // { gainers, losers, mostActive, timestamp }
  trendingLoading: false,
  trendingError: null,

  // Recent searches (persisted to localStorage)
  recentSearches: loadRecentSearches(),
  recentQuotes: {}, // { [symbol]: quote }

  // === SELECTORS ===

  getResults: () => get().results,
  getTrending: () => get().trending,
  getRecentSearches: () => get().recentSearches,

  isTrendingStale: () => {
    const { trending } = get();
    if (!trending) return true;
    return Date.now() - trending.timestamp > TRENDING_CACHE_TTL;
  },

  getCachedSearch: (query, mode, typeFilter) => {
    const cacheKey = `search:${mode}:${typeFilter}:${query.toLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      return cached.data;
    }
    return null;
  },

  // === ACTIONS ===

  search: async (query, options = {}) => {
    const {
      mode = get().searchMode,
      typeFilter = get().typeFilter,
      includeQuotes = true,
      limit = 10,
    } = options;

    if (!query || query.trim().length === 0) {
      set({ results: [], categories: { stocks: 0, etps: 0 }, totalMatches: 0 });
      return { results: [], categories: { stocks: 0, etps: 0 }, totalMatches: 0 };
    }

    // Check cache
    const cached = get().getCachedSearch(query, mode, typeFilter);
    if (cached) {
      set({
        results: cached.results,
        categories: cached.categories,
        totalMatches: cached.totalMatches,
        searchQuery: query,
      });
      return cached;
    }

    set({ isSearching: true, searchError: null, searchQuery: query });

    try {
      const params = new URLSearchParams({
        q: query,
        mode,
        includeQuotes: includeQuotes.toString(),
        limit: limit.toString(),
      });
      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const data = await api.get(`/search?${params.toString()}`);

      // Cache the result
      const cacheKey = `search:${mode}:${typeFilter}:${query.toLowerCase()}`;
      searchCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      set({
        results: data.results || [],
        categories: data.categories || { stocks: 0, etps: 0 },
        totalMatches: data.totalMatches || 0,
        isSearching: false,
      });

      return data;
    } catch (error) {
      set({
        isSearching: false,
        searchError: error.message,
        results: [],
      });
      throw error;
    }
  },

  fetchSuggestions: async (prefix) => {
    if (!prefix || prefix.length === 0) {
      set({ suggestions: [], suggestionHint: '' });
      return { suggestions: [], hint: '' };
    }

    try {
      const data = await api.get(`/search/suggestions?q=${encodeURIComponent(prefix)}&limit=1`);
      set({
        suggestions: data.suggestions || [],
        suggestionHint: data.hint || '',
      });
      return data;
    } catch {
      set({ suggestions: [], suggestionHint: '' });
      return { suggestions: [], hint: '' };
    }
  },

  fetchTrending: async (limit = 5, force = false) => {
    const { isTrendingStale, trending, trendingLoading } = get();

    if (!force && !isTrendingStale() && trending) {
      return trending;
    }

    if (trendingLoading) {
      return trending;
    }

    set({ trendingLoading: true, trendingError: null });

    try {
      const data = await api.get(`/search/trending?limit=${limit}`);
      const trendingData = {
        ...data,
        timestamp: Date.now(),
      };
      set({
        trending: trendingData,
        trendingLoading: false,
      });
      return trendingData;
    } catch (error) {
      set({
        trendingLoading: false,
        trendingError: error.message,
      });
      throw error;
    }
  },

  fetchRecentQuotes: async () => {
    const { recentSearches } = get();
    const symbols = recentSearches.map((s) => s.symbol);

    if (symbols.length === 0) return {};

    try {
      const data = await api.post('/quotes/batch', { symbols });
      set({ recentQuotes: data });
      return data;
    } catch {
      return {};
    }
  },

  addRecentSearch: (symbol, description = '') => {
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return;

    set((state) => {
      // Remove if already exists
      const filtered = state.recentSearches.filter(
        (s) => s.symbol !== upperSymbol
      );
      // Add to front
      const updated = [
        { symbol: upperSymbol, description },
        ...filtered,
      ].slice(0, MAX_RECENT_SEARCHES);

      // Persist to localStorage
      saveRecentSearches(updated);

      return { recentSearches: updated };
    });
  },

  removeRecentSearch: (symbol) => {
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return;

    set((state) => {
      const updated = state.recentSearches.filter(
        (s) => s.symbol !== upperSymbol
      );
      saveRecentSearches(updated);
      return { recentSearches: updated };
    });
  },

  clearRecentSearches: () => {
    saveRecentSearches([]);
    set({ recentSearches: [], recentQuotes: {} });
  },

  clearSearch: () => {
    set({
      results: [],
      categories: { stocks: 0, etps: 0 },
      totalMatches: 0,
      searchQuery: '',
      suggestions: [],
      suggestionHint: '',
    });
  },

  setSearchMode: (mode) => {
    set({ searchMode: mode });
  },

  setTypeFilter: (filter) => {
    set({ typeFilter: filter });
  },

  clearCache: () => {
    searchCache.clear();
    set({ trending: null });
  },

  clearError: () => {
    set({ searchError: null, trendingError: null });
  },
}));

export default useSearchStore;
