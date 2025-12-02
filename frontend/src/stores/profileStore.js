import { create } from 'zustand';
import api from '../api/client';

const CACHE_TTL = 300000; // 5 minutes

// Pending requests map for deduplication
const pendingRequests = new Map();

export const useProfileStore = create((set, get) => ({
  // === STATE ===
  profiles: {}, // { [symbol]: { data, timestamp } }
  isLoading: {}, // { [symbol]: boolean }
  error: {}, // { [symbol]: string }

  // === SELECTORS ===

  getProfile: (symbol) => {
    const { profiles } = get();
    const upperSymbol = symbol?.toUpperCase();
    return profiles[upperSymbol]?.data || null;
  },

  isStale: (symbol) => {
    const { profiles } = get();
    const upperSymbol = symbol?.toUpperCase();
    const cached = profiles[upperSymbol];
    if (!cached) return true;
    return Date.now() - cached.timestamp > CACHE_TTL;
  },

  hasProfile: (symbol) => {
    const { profiles } = get();
    return !!profiles[symbol?.toUpperCase()];
  },

  isProfileLoading: (symbol) => {
    return get().isLoading[symbol?.toUpperCase()] || false;
  },

  getProfileError: (symbol) => {
    return get().error[symbol?.toUpperCase()] || null;
  },

  // === ACTIONS ===

  fetchProfile: async (symbol, force = false) => {
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return null;

    // Check cache first
    if (!force && !get().isStale(upperSymbol)) {
      const cached = get().getProfile(upperSymbol);
      if (cached) return cached;
    }

    // Check if request is already pending (deduplication)
    if (pendingRequests.has(upperSymbol)) {
      return pendingRequests.get(upperSymbol);
    }

    // Set loading state
    set((state) => ({
      isLoading: { ...state.isLoading, [upperSymbol]: true },
      error: { ...state.error, [upperSymbol]: null },
    }));

    // Create the request promise
    const requestPromise = (async () => {
      try {
        const data = await api.get(`/quotes/${upperSymbol}/profile`);

        set((state) => ({
          profiles: {
            ...state.profiles,
            [upperSymbol]: {
              data,
              timestamp: Date.now(),
            },
          },
          isLoading: { ...state.isLoading, [upperSymbol]: false },
        }));

        return data;
      } catch (error) {
        set((state) => ({
          isLoading: { ...state.isLoading, [upperSymbol]: false },
          error: { ...state.error, [upperSymbol]: error.message },
        }));
        throw error;
      } finally {
        pendingRequests.delete(upperSymbol);
      }
    })();

    // Store the pending request
    pendingRequests.set(upperSymbol, requestPromise);

    return requestPromise;
  },

  // Prefetch profile (fire and forget, no error handling)
  prefetchProfile: (symbol) => {
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return;

    // Don't prefetch if already cached and not stale
    if (!get().isStale(upperSymbol)) return;

    // Don't prefetch if already loading
    if (pendingRequests.has(upperSymbol)) return;

    // Silently fetch in background
    get().fetchProfile(upperSymbol).catch(() => {
      // Ignore errors for prefetch
    });
  },

  // Batch prefetch multiple profiles
  prefetchProfiles: (symbols) => {
    if (!symbols || symbols.length === 0) return;

    const { prefetchProfile } = get();
    symbols.forEach((symbol) => {
      prefetchProfile(symbol);
    });
  },

  invalidateProfile: (symbol) => {
    const upperSymbol = symbol?.toUpperCase();
    if (!upperSymbol) return;

    set((state) => {
      const newProfiles = { ...state.profiles };
      delete newProfiles[upperSymbol];
      return { profiles: newProfiles };
    });
  },

  clearCache: () => {
    set({ profiles: {}, error: {} });
  },

  clearError: (symbol = null) => {
    if (symbol) {
      const upperSymbol = symbol.toUpperCase();
      set((state) => {
        const newError = { ...state.error };
        delete newError[upperSymbol];
        return { error: newError };
      });
    } else {
      set({ error: {} });
    }
  },
}));

export default useProfileStore;
