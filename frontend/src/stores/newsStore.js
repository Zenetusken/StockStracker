import { create } from 'zustand';
import api from '../api/client';

const CACHE_TTL = 300000; // 5 minutes

// Pending requests map for deduplication
const pendingRequests = new Map();

// Generate cache key for news request
function getCacheKey(symbol, category) {
  if (symbol) {
    return `company:${symbol.toUpperCase()}`;
  }
  return `market:${category || 'general'}`;
}

export const useNewsStore = create((set, get) => ({
  // === STATE ===
  // { [cacheKey]: { data: [], timestamp: number } }
  news: {},
  isLoading: {}, // { [cacheKey]: boolean }
  error: {}, // { [cacheKey]: string }

  // === SELECTORS ===

  getNews: (symbol, category) => {
    const cacheKey = getCacheKey(symbol, category);
    const { news } = get();
    return news[cacheKey]?.data || null;
  },

  isStale: (symbol, category) => {
    const cacheKey = getCacheKey(symbol, category);
    const { news } = get();
    const cached = news[cacheKey];
    if (!cached) return true;
    return Date.now() - cached.timestamp > CACHE_TTL;
  },

  isNewsLoading: (symbol, category) => {
    const cacheKey = getCacheKey(symbol, category);
    return get().isLoading[cacheKey] || false;
  },

  getNewsError: (symbol, category) => {
    const cacheKey = getCacheKey(symbol, category);
    return get().error[cacheKey] || null;
  },

  // === ACTIONS ===

  fetchNews: async (symbol, category, force = false) => {
    const cacheKey = getCacheKey(symbol, category);

    // Check cache first
    if (!force && !get().isStale(symbol, category)) {
      const cached = get().getNews(symbol, category);
      if (cached) return cached;
    }

    // Check if request is already pending (deduplication)
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }

    // Set loading state
    set((state) => ({
      isLoading: { ...state.isLoading, [cacheKey]: true },
      error: { ...state.error, [cacheKey]: null },
    }));

    // Create the request promise
    const requestPromise = (async () => {
      try {
        let data;
        if (symbol) {
          // Fetch company-specific news
          data = await api.get(`/news/${symbol.toUpperCase()}`);
        } else if (category === 'canada') {
          // Fetch Canadian market news via Yahoo Finance
          data = await api.get('/news/market/canada');
        } else {
          // Fetch general market news with category filter
          data = await api.get(`/news/market/general?category=${category || 'general'}`);
        }

        const articles = Array.isArray(data) ? data : [];

        set((state) => ({
          news: {
            ...state.news,
            [cacheKey]: {
              data: articles,
              timestamp: Date.now(),
            },
          },
          isLoading: { ...state.isLoading, [cacheKey]: false },
        }));

        return articles;
      } catch (error) {
        set((state) => ({
          isLoading: { ...state.isLoading, [cacheKey]: false },
          error: { ...state.error, [cacheKey]: error.message },
        }));
        throw error;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store the pending request
    pendingRequests.set(cacheKey, requestPromise);

    return requestPromise;
  },

  // Invalidate specific news cache
  invalidateNews: (symbol, category) => {
    const cacheKey = getCacheKey(symbol, category);
    set((state) => {
      const newNews = { ...state.news };
      delete newNews[cacheKey];
      return { news: newNews };
    });
  },

  // Clear all news cache
  clearCache: () => {
    set({ news: {}, error: {} });
  },

  clearError: (symbol = null, category = null) => {
    if (symbol || category) {
      const cacheKey = getCacheKey(symbol, category);
      set((state) => {
        const newError = { ...state.error };
        delete newError[cacheKey];
        return { error: newError };
      });
    } else {
      set({ error: {} });
    }
  },
}));

export default useNewsStore;
