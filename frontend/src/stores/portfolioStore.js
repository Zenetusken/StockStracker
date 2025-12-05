import { create } from 'zustand';
import api from '../api/client';

const CACHE_TTL = 30000; // 30 seconds for list
const DETAIL_CACHE_TTL = 60000; // 60 seconds for details

// Request deduplication: prevents concurrent duplicate API calls (H4 fix)
const pendingRequests = new Map();

export const usePortfolioStore = create((set, get) => ({
  // === STATE ===
  portfolios: [],
  portfolioDetails: {}, // { [id]: { data, timestamp } }
  isLoading: false,
  isLoadingDetail: {}, // { [id]: boolean }
  error: null,
  lastFetch: null,

  // === SELECTORS ===

  getPortfolio: (id) => {
    const { portfolios } = get();
    return portfolios.find((p) => p.id === parseInt(id)) || null;
  },

  getPortfolioDetail: (id) => {
    const { portfolioDetails } = get();
    return portfolioDetails[id]?.data || null;
  },

  getPortfolioHoldings: (id) => {
    const detail = get().getPortfolioDetail(id);
    return detail?.holdings || [];
  },

  getDefaultPortfolio: () => {
    const { portfolios } = get();
    return portfolios.find((p) => p.is_default) || portfolios[0] || null;
  },

  isCacheValid: () => {
    const { lastFetch } = get();
    return lastFetch && Date.now() - lastFetch < CACHE_TTL;
  },

  isDetailCacheValid: (id) => {
    const { portfolioDetails } = get();
    const detail = portfolioDetails[id];
    return detail && Date.now() - detail.timestamp < DETAIL_CACHE_TTL;
  },

  // === ACTIONS ===

  fetchPortfolios: async (force = false) => {
    const { isCacheValid } = get();
    if (!force && isCacheValid()) return get().portfolios;

    // Request deduplication: return pending request if one exists
    const pendingKey = 'portfolios';
    if (pendingRequests.has(pendingKey)) {
      return pendingRequests.get(pendingKey);
    }

    // Create and store the promise
    const requestPromise = (async () => {
      set({ isLoading: true, error: null });
      try {
        const data = await api.get('/portfolios');
        set({
          portfolios: data,
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

  fetchPortfolioDetail: async (id, force = false) => {
    const { isDetailCacheValid } = get();
    if (!force && isDetailCacheValid(id)) return get().getPortfolioDetail(id);

    // Request deduplication: return pending request if one exists
    const pendingKey = `portfolio-detail-${id}`;
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
        const data = await api.get(`/portfolios/${id}`);
        set((state) => ({
          portfolioDetails: {
            ...state.portfolioDetails,
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

  createPortfolio: async (name, description = '', cashBalance = 0, isPaperTrading = false) => {
    set({ error: null });
    try {
      const data = await api.post('/portfolios', {
        name,
        description,
        cash_balance: cashBalance,
        is_paper_trading: isPaperTrading,
      });
      // Add to list
      set((state) => ({
        portfolios: [...state.portfolios, data],
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updatePortfolio: async (id, updates) => {
    const previous = get().getPortfolio(id);

    // Optimistic update
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === parseInt(id) ? { ...p, ...updates } : p
      ),
    }));

    try {
      const data = await api.put(`/portfolios/${id}`, updates);
      // Update with server response
      set((state) => ({
        portfolios: state.portfolios.map((p) =>
          p.id === parseInt(id) ? { ...p, ...data } : p
        ),
      }));
      return data;
    } catch (error) {
      // Rollback
      if (previous) {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === parseInt(id) ? previous : p
          ),
          error: error.message,
        }));
      }
      throw error;
    }
  },

  deletePortfolio: async (id) => {
    const previousPortfolios = get().portfolios;

    // Optimistic update
    set((state) => ({
      portfolios: state.portfolios.filter((p) => p.id !== parseInt(id)),
    }));

    try {
      await api.delete(`/portfolios/${id}`);
      // Remove from details cache
      get()._invalidateDetail(id);
    } catch (error) {
      // Rollback
      set({
        portfolios: previousPortfolios,
        error: error.message,
      });
      throw error;
    }
  },

  addTransaction: async (portfolioId, transaction) => {
    set({ error: null });
    try {
      const data = await api.post(`/portfolios/${portfolioId}/transactions`, transaction);

      // Invalidate the portfolio detail cache to force refresh
      get()._invalidateDetail(portfolioId);

      // Update portfolio cash balance in the list
      if (data.portfolio) {
        set((state) => ({
          portfolios: state.portfolios.map((p) =>
            p.id === parseInt(portfolioId)
              ? { ...p, cash_balance: data.portfolio.cash_balance }
              : p
          ),
        }));
      }

      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateTransaction: async (portfolioId, transactionId, updates) => {
    set({ error: null });
    try {
      const data = await api.put(`/portfolios/${portfolioId}/transactions/${transactionId}`, updates);

      // Invalidate the portfolio detail cache to force refresh
      get()._invalidateDetail(portfolioId);

      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteTransaction: async (portfolioId, transactionId) => {
    set({ error: null });
    try {
      const data = await api.delete(`/portfolios/${portfolioId}/transactions/${transactionId}`);

      // Invalidate the portfolio detail cache to force refresh
      get()._invalidateDetail(portfolioId);

      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  fetchTaxLots: async (portfolioId, symbol) => {
    try {
      const data = await api.get(`/portfolios/${portfolioId}/holdings/${symbol}/tax-lots`);
      return data;
    } catch (error) {
      console.error('Error fetching tax lots:', error);
      throw error;
    }
  },

  fetchLotSales: async (portfolioId, year = null, symbol = null) => {
    try {
      let url = `/portfolios/${portfolioId}/lot-sales`;
      const params = new URLSearchParams();
      if (year) params.append('year', year);
      if (symbol) params.append('symbol', symbol);
      if (params.toString()) url += `?${params.toString()}`;
      const data = await api.get(url);
      return data;
    } catch (error) {
      console.error('Error fetching lot sales:', error);
      throw error;
    }
  },

  fetchValueHistory: async (portfolioId, period = '1M') => {
    try {
      const data = await api.get(`/portfolios/${portfolioId}/value-history?period=${period}`);
      return data;
    } catch (error) {
      console.error('Error fetching value history:', error);
      throw error;
    }
  },

  invalidateCache: () => {
    set({ lastFetch: null, portfolioDetails: {} });
  },

  // L3 fix: Helper to invalidate a single portfolio's detail cache
  _invalidateDetail: (id) => {
    set((state) => {
      const { [id]: _, ...rest } = state.portfolioDetails;
      return { portfolioDetails: rest };
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default usePortfolioStore;
