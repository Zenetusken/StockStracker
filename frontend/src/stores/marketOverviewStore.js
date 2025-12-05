import { create } from 'zustand';
import api from '../api/client';

// Cache TTL: 60 seconds for market overview data
const CACHE_TTL = 60000;
// Movers cache TTL: 90 seconds (aligned with backend screener cache)
const MOVERS_CACHE_TTL = 90000;

// Request deduplication: prevents concurrent duplicate API calls
const pendingRequests = new Map();

/**
 * Market Overview Store (M1 fix, N3 fix)
 * Centralizes market overview, sector data, and top movers with caching
 */
export const useMarketOverviewStore = create((set, get) => ({
  // === STATE ===
  overview: null,        // { indices, sentiment, breadth }
  sectorData: null,      // { sectors, breadth, analysis }
  movers: null,          // N3 fix: Enhanced movers data { categories, timestamp }
  moversLastFetch: null, // N3 fix: Separate cache timestamp for movers
  isLoading: false,
  isLoadingMovers: false, // N3 fix: Separate loading state for movers
  error: null,
  lastFetch: null,

  // === SELECTORS ===

  isCacheValid: () => {
    const { lastFetch } = get();
    return lastFetch && Date.now() - lastFetch < CACHE_TTL;
  },

  getIndices: () => get().overview?.indices || [],

  getSentiment: () => get().overview?.sentiment || null,

  getSectors: () => get().sectorData?.sectors || get().overview?.sectors || [],

  getSectorBreadth: () => get().sectorData?.breadth || null,

  getSectorAnalysis: () => get().sectorData?.analysis || null,

  // N3 fix: Movers selectors
  isMoversValid: () => {
    const { moversLastFetch } = get();
    return moversLastFetch && Date.now() - moversLastFetch < MOVERS_CACHE_TTL;
  },

  getMovers: () => get().movers,

  getMoversCategories: () => get().movers?.categories || {},

  // === ACTIONS ===

  fetchOverview: async (force = false) => {
    const { isCacheValid } = get();
    if (!force && isCacheValid()) {
      return { overview: get().overview, sectorData: get().sectorData };
    }

    // Request deduplication
    const pendingKey = 'market-overview';
    if (pendingRequests.has(pendingKey)) {
      return pendingRequests.get(pendingKey);
    }

    const requestPromise = (async () => {
      set({ isLoading: true, error: null });

      try {
        // Pass ?fresh=true to bypass backend cache when force refresh requested
        const freshParam = force ? '?fresh=true' : '';

        // Fetch both endpoints in parallel
        const [overviewResult, sectorResult] = await Promise.all([
          api.get(`/market/overview${freshParam}`),
          api.get(`/market/sectors/performance${freshParam}`).catch(() => null),
        ]);

        set({
          overview: overviewResult,
          sectorData: sectorResult,
          isLoading: false,
          lastFetch: Date.now(),
        });

        return { overview: overviewResult, sectorData: sectorResult };
      } catch (error) {
        set({
          isLoading: false,
          error: error.message || 'Failed to load market data',
        });
        throw error;
      } finally {
        pendingRequests.delete(pendingKey);
      }
    })();

    pendingRequests.set(pendingKey, requestPromise);
    return requestPromise;
  },

  // N3 fix: Fetch movers with caching and deduplication
  fetchMovers: async (force = false) => {
    const { isMoversValid } = get();
    if (!force && isMoversValid()) {
      return get().movers;
    }

    // Request deduplication
    const pendingKey = 'market-movers';
    if (pendingRequests.has(pendingKey)) {
      return pendingRequests.get(pendingKey);
    }

    const requestPromise = (async () => {
      set({ isLoadingMovers: true });

      try {
        const freshParam = force ? '?fresh=true' : '';
        const moversResult = await api.get(`/market/movers/enhanced${freshParam}`);

        set({
          movers: moversResult,
          isLoadingMovers: false,
          moversLastFetch: Date.now(),
        });

        return moversResult;
      } catch (error) {
        set({
          isLoadingMovers: false,
          error: error.message || 'Failed to load movers',
        });
        throw error;
      } finally {
        pendingRequests.delete(pendingKey);
      }
    })();

    pendingRequests.set(pendingKey, requestPromise);
    return requestPromise;
  },

  invalidateCache: () => {
    set({ lastFetch: null });
  },

  invalidateMoversCache: () => {
    set({ moversLastFetch: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useMarketOverviewStore;
