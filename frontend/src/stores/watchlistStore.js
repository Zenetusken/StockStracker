import { create } from 'zustand';
import api from '../api/client';

const CACHE_TTL = 30000; // 30 seconds for list
const DETAIL_CACHE_TTL = 60000; // 60 seconds for details

// Request deduplication: prevents concurrent duplicate API calls (H4 fix)
const pendingRequests = new Map();

export const useWatchlistStore = create((set, get) => ({
  // === STATE ===
  watchlists: [],
  watchlistDetails: {}, // { [id]: { data, timestamp } }
  isLoading: false,
  isLoadingDetail: {}, // { [id]: boolean }
  error: null,
  lastFetch: null,

  // === SELECTORS ===

  getWatchlist: (id) => {
    const { watchlists } = get();
    return watchlists.find((w) => w.id === parseInt(id)) || null;
  },

  getWatchlistDetail: (id) => {
    const { watchlistDetails } = get();
    return watchlistDetails[id]?.data || null;
  },

  getWatchlistItems: (id) => {
    const detail = get().getWatchlistDetail(id);
    return detail?.items || [];
  },

  isSymbolInWatchlist: (watchlistId, symbol) => {
    const items = get().getWatchlistItems(watchlistId);
    return items.some((item) => item.symbol?.toUpperCase() === symbol?.toUpperCase());
  },

  getWatchlistsContainingSymbol: (symbol) => {
    const { watchlistDetails } = get();
    const upperSymbol = symbol?.toUpperCase();
    return Object.entries(watchlistDetails)
      .filter(([, detail]) =>
        detail?.data?.items?.some((item) => item.symbol?.toUpperCase() === upperSymbol)
      )
      .map(([id]) => parseInt(id));
  },

  getDefaultWatchlist: () => {
    const { watchlists } = get();
    return watchlists.find((w) => w.is_default) || watchlists[0] || null;
  },

  isCacheValid: () => {
    const { lastFetch } = get();
    return lastFetch && Date.now() - lastFetch < CACHE_TTL;
  },

  isDetailCacheValid: (id) => {
    const { watchlistDetails } = get();
    const detail = watchlistDetails[id];
    return detail && Date.now() - detail.timestamp < DETAIL_CACHE_TTL;
  },

  // === ACTIONS ===

  fetchWatchlists: async (force = false) => {
    const { isCacheValid } = get();
    if (!force && isCacheValid()) return get().watchlists;

    // Request deduplication: return pending request if one exists
    const pendingKey = 'watchlists';
    if (pendingRequests.has(pendingKey)) {
      return pendingRequests.get(pendingKey);
    }

    // Create and store the promise
    const requestPromise = (async () => {
      set({ isLoading: true, error: null });
      try {
        const data = await api.get('/watchlists');
        set({
          watchlists: data,
          isLoading: false,
          lastFetch: Date.now(),
        });
        return data;
      } catch (error) {
        set({ isLoading: false, error: error.message });
        throw error;
      } finally {
        pendingRequests.delete(pendingKey);
      }
    })();

    pendingRequests.set(pendingKey, requestPromise);
    return requestPromise;
  },

  fetchWatchlistDetail: async (id, force = false) => {
    const { isDetailCacheValid } = get();
    if (!force && isDetailCacheValid(id)) return get().getWatchlistDetail(id);

    // Request deduplication: return pending request if one exists
    const pendingKey = `watchlist-detail-${id}`;
    if (pendingRequests.has(pendingKey)) {
      return pendingRequests.get(pendingKey);
    }

    // Create and store the promise
    const requestPromise = (async () => {
      set((state) => ({
        isLoadingDetail: { ...state.isLoadingDetail, [id]: true },
        error: null,
      }));

      try {
        const data = await api.get(`/watchlists/${id}`);
        set((state) => ({
          watchlistDetails: {
            ...state.watchlistDetails,
            [id]: { data, timestamp: Date.now() },
          },
          isLoadingDetail: { ...state.isLoadingDetail, [id]: false },
        }));
        return data;
      } catch (error) {
        set((state) => ({
          isLoadingDetail: { ...state.isLoadingDetail, [id]: false },
          error: error.message,
        }));
        throw error;
      } finally {
        pendingRequests.delete(pendingKey);
      }
    })();

    pendingRequests.set(pendingKey, requestPromise);
    return requestPromise;
  },

  createWatchlist: async (name, color = '#3B82F6', icon = 'list') => {
    set({ error: null });
    try {
      const data = await api.post('/watchlists', { name, color, icon });
      // Add to list
      set((state) => ({
        watchlists: [...state.watchlists, data],
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateWatchlist: async (id, updates) => {
    const previous = get().getWatchlist(id);

    // Optimistic update
    set((state) => ({
      watchlists: state.watchlists.map((w) =>
        w.id === parseInt(id) ? { ...w, ...updates } : w
      ),
    }));

    try {
      const data = await api.put(`/watchlists/${id}`, updates);
      // Update with server response
      set((state) => ({
        watchlists: state.watchlists.map((w) =>
          w.id === parseInt(id) ? { ...w, ...data } : w
        ),
      }));
      return data;
    } catch (error) {
      // Rollback
      if (previous) {
        set((state) => ({
          watchlists: state.watchlists.map((w) =>
            w.id === parseInt(id) ? previous : w
          ),
          error: error.message,
        }));
      }
      throw error;
    }
  },

  deleteWatchlist: async (id) => {
    const previousWatchlists = get().watchlists;

    // Optimistic update
    set((state) => ({
      watchlists: state.watchlists.filter((w) => w.id !== parseInt(id)),
    }));

    try {
      await api.delete(`/watchlists/${id}`);
      // Remove from details cache
      set((state) => {
        const newDetails = { ...state.watchlistDetails };
        delete newDetails[id];
        return { watchlistDetails: newDetails };
      });
    } catch (error) {
      // Rollback
      set({
        watchlists: previousWatchlists,
        error: error.message,
      });
      throw error;
    }
  },

  addSymbol: async (watchlistId, symbol) => {
    const previousDetail = get().watchlistDetails[watchlistId];
    const upperSymbol = symbol.toUpperCase();

    // Optimistic update
    set((state) => {
      const detail = state.watchlistDetails[watchlistId];
      if (detail) {
        return {
          watchlistDetails: {
            ...state.watchlistDetails,
            [watchlistId]: {
              ...detail,
              data: {
                ...detail.data,
                items: [...(detail.data?.items || []), { symbol: upperSymbol }],
              },
            },
          },
          watchlists: state.watchlists.map((w) =>
            w.id === parseInt(watchlistId)
              ? { ...w, item_count: (w.item_count || 0) + 1 }
              : w
          ),
        };
      }
      return {
        watchlists: state.watchlists.map((w) =>
          w.id === parseInt(watchlistId)
            ? { ...w, item_count: (w.item_count || 0) + 1 }
            : w
        ),
      };
    });

    try {
      const response = await api.post(`/watchlists/${watchlistId}/items`, { symbol: upperSymbol });
      return response;
    } catch (error) {
      // 409 means already exists - treat as success
      if (error.status === 409) {
        return { success: true, alreadyExists: true };
      }
      // Rollback on other errors
      if (previousDetail) {
        set((state) => ({
          watchlistDetails: {
            ...state.watchlistDetails,
            [watchlistId]: previousDetail,
          },
          watchlists: state.watchlists.map((w) =>
            w.id === parseInt(watchlistId)
              ? { ...w, item_count: Math.max(0, (w.item_count || 1) - 1) }
              : w
          ),
          error: error.message,
        }));
      }
      throw error;
    }
  },

  removeSymbol: async (watchlistId, symbol) => {
    const previousDetail = get().watchlistDetails[watchlistId];
    const upperSymbol = symbol.toUpperCase();

    // Optimistic update
    set((state) => {
      const detail = state.watchlistDetails[watchlistId];
      if (detail) {
        return {
          watchlistDetails: {
            ...state.watchlistDetails,
            [watchlistId]: {
              ...detail,
              data: {
                ...detail.data,
                items: detail.data?.items?.filter(
                  (item) => item.symbol?.toUpperCase() !== upperSymbol
                ) || [],
              },
            },
          },
          watchlists: state.watchlists.map((w) =>
            w.id === parseInt(watchlistId)
              ? { ...w, item_count: Math.max(0, (w.item_count || 1) - 1) }
              : w
          ),
        };
      }
      return {
        watchlists: state.watchlists.map((w) =>
          w.id === parseInt(watchlistId)
            ? { ...w, item_count: Math.max(0, (w.item_count || 1) - 1) }
            : w
        ),
      };
    });

    try {
      await api.delete(`/watchlists/${watchlistId}/items/${upperSymbol}`);
    } catch (error) {
      // Rollback
      if (previousDetail) {
        set((state) => ({
          watchlistDetails: {
            ...state.watchlistDetails,
            [watchlistId]: previousDetail,
          },
          watchlists: state.watchlists.map((w) =>
            w.id === parseInt(watchlistId)
              ? { ...w, item_count: (w.item_count || 0) + 1 }
              : w
          ),
          error: error.message,
        }));
      }
      throw error;
    }
  },

  reorderItems: async (watchlistId, items) => {
    const previousDetail = get().watchlistDetails[watchlistId];

    // Optimistic update
    set((state) => {
      const detail = state.watchlistDetails[watchlistId];
      if (detail) {
        return {
          watchlistDetails: {
            ...state.watchlistDetails,
            [watchlistId]: {
              ...detail,
              data: {
                ...detail.data,
                items,
              },
            },
          },
        };
      }
      return state;
    });

    try {
      await api.put(`/watchlists/${watchlistId}/items/reorder`, { items });
    } catch (error) {
      // Rollback
      if (previousDetail) {
        set((state) => ({
          watchlistDetails: {
            ...state.watchlistDetails,
            [watchlistId]: previousDetail,
          },
          error: error.message,
        }));
      }
      throw error;
    }
  },

  invalidateCache: () => {
    set({ lastFetch: null, watchlistDetails: {} });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useWatchlistStore;
